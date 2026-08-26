"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";

async function requireTemplateManager() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const };
  if (!access.canManage("fleet")) {
    return { error: "You do not have permission to manage checklists." as const };
  }
  return { error: null };
}

/**
 * Creates a checklist and its items together.
 *
 * Items are inserted with the template rather than added afterwards, because a
 * template becomes immutable the moment a crew completes it — a half-built
 * list that someone has already signed is not something the database will let
 * you finish.
 */
export async function createChecklist(formData: FormData) {
  const guard = await requireTemplateManager();
  if (guard.error) return { error: guard.error };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const appliesToModel = String(formData.get("applies_to_model") ?? "").trim();

  const prompts = formData.getAll("prompt").map((v) => String(v).trim());
  const criticalFlags = formData.getAll("critical").map((v) => String(v) === "true");

  if (!name) return { error: "Give the checklist a name." };

  const items = prompts
    .map((prompt, i) => ({ prompt, critical: criticalFlags[i] ?? false }))
    .filter((item) => item.prompt !== "");

  if (items.length === 0) {
    return { error: "A checklist needs at least one item." };
  }

  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("checklist_templates")
    .insert({
      name,
      description: description || null,
      applies_to_model: appliesToModel || null,
    })
    .select("id")
    .single();

  if (error || !template) {
    return { error: safeErrorMessage(error ?? { message: "insert failed" }, "save") };
  }

  const { error: itemsError } = await supabase.from("checklist_items").insert(
    items.map((item, index) => ({
      template_id: template.id,
      prompt: item.prompt,
      critical: item.critical,
      sort_order: index,
    })),
  );

  if (itemsError) {
    // A checklist with no items is not a checklist; remove it rather than
    // leave an empty one that can never be added to once used.
    await supabase.from("checklist_templates").delete().eq("id", template.id);
    return { error: safeErrorMessage(itemsError, "save") };
  }

  revalidatePath("/checklists");
  revalidatePath("/flights");
  return { error: null };
}

export async function setChecklistActive(templateId: string, active: boolean) {
  const guard = await requireTemplateManager();
  if (guard.error) return { error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_templates")
    .update({ active })
    .eq("id", templateId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/checklists");
  revalidatePath("/flights");
  return { error: null };
}

export async function deleteChecklist(templateId: string) {
  const guard = await requireTemplateManager();
  if (guard.error) return { error: guard.error };

  const supabase = await createClient();

  const { count } = await supabase
    .from("checklist_completions")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);

  if ((count ?? 0) > 0) {
    return {
      error: `This checklist has been completed ${count} time${count === 1 ? "" : "s"}, and those records are evidence. Deactivate it instead.`,
    };
  }

  const { error } = await supabase.from("checklist_templates").delete().eq("id", templateId);
  if (error) return { error: safeErrorMessage(error, "delete") };

  revalidatePath("/checklists");
  return { error: null };
}

/**
 * Records a crew completing a checklist.
 *
 * The verdict on no-go items is worked out here and stored, because it is a
 * statement about what was true at this moment. Recomputing it later from a
 * template that has since been replaced would rewrite what the crew signed.
 */
export async function completeChecklist(formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canCreate("requests")) {
    return { error: "You do not have permission to complete checklists." };
  }

  const templateId = String(formData.get("template_id") ?? "");
  const uavId = String(formData.get("uav_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const checkedIds = new Set(formData.getAll("checked").map(String));

  if (!templateId) return { error: "Choose a checklist." };

  const supabase = await createClient();

  const { data: items } = await supabase
    .from("checklist_items")
    .select("id, critical")
    .eq("template_id", templateId)
    .order("sort_order");

  if (!items || items.length === 0) {
    return { error: "That checklist has no items. Refresh and try again." };
  }

  const allCriticalPassed = items
    .filter((item) => item.critical)
    .every((item) => checkedIds.has(item.id));

  const { data: completion, error } = await supabase
    .from("checklist_completions")
    .insert({
      template_id: templateId,
      uav_id: uavId || null,
      completed_by: access.userId,
      all_critical_passed: allCriticalPassed,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error || !completion) {
    return { error: safeErrorMessage(error ?? { message: "insert failed" }, "checklist") };
  }

  const { error: responsesError } = await supabase.from("checklist_responses").insert(
    items.map((item) => ({
      completion_id: completion.id,
      item_id: item.id,
      checked: checkedIds.has(item.id),
    })),
  );

  if (responsesError) {
    // A completion with no responses claims a check happened without recording
    // what was checked, which is worse than no record.
    await supabase.from("checklist_completions").delete().eq("id", completion.id);
    return { error: safeErrorMessage(responsesError, "checklist") };
  }

  revalidatePath("/checklists");
  revalidatePath("/flights");
  return { error: null, allCriticalPassed };
}
