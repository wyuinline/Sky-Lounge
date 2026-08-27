"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { TOP_LEVEL } from "@/lib/manual-constants";

/**
 * Operations manuals.
 *
 * A manual is a tree of sections over documents that already exist. Nothing
 * here writes a section number: numbers are derived from position by the
 * manual_contents view, so inserting a section renumbers everything below it
 * and the contents page can never disagree with the headings.
 */

const WORKFLOW_STATUSES = ["draft", "pending_approval", "approved", "published"] as const;

export async function createManual(formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in.", id: null };
  if (!access.canManage("docs_general")) {
    return { error: "You do not have permission to create manuals.", id: null };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the manual a title.", id: null };

  const revision = String(formData.get("revision") ?? "").trim() || "1";
  const effectiveDate = String(formData.get("effective_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manuals")
    .insert({
      title,
      revision,
      effective_date: effectiveDate || null,
      description: description || null,
      created_by: access.userId,
    })
    .select("id")
    .single();

  if (error) return { error: safeErrorMessage(error, "manual"), id: null };

  revalidatePath("/documents");
  return { error: null, id: data.id };
}

export async function updateManual(manualId: string, formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("docs_general")) {
    return { error: "You do not have permission to change manuals." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the manual a title." };

  const revision = String(formData.get("revision") ?? "").trim() || "1";
  const effectiveDate = String(formData.get("effective_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const approvalStatus = parseEnum(formData.get("approval_status"), WORKFLOW_STATUSES, "draft");

  const supabase = await createClient();
  const { error } = await supabase
    .from("manuals")
    .update({
      title,
      revision,
      effective_date: effectiveDate || null,
      description: description || null,
      approval_status: approvalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", manualId);

  if (error) return { error: safeErrorMessage(error, "manual") };

  revalidatePath("/documents");
  revalidatePath(`/documents/manuals/${manualId}`);
  return { error: null };
}

/**
 * Adds a section.
 *
 * A section points at a document or carries its own text, never both. The
 * database enforces it too — two sources for one section will disagree, and
 * the disagreement surfaces in front of a reviewer.
 */
export async function addManualSection(manualId: string, formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("docs_general")) {
    return { error: "You do not have permission to change manuals." };
  }

  const heading = String(formData.get("heading") ?? "").trim();
  if (!heading) return { error: "Give the section a heading." };

  const parentRaw = String(formData.get("parent_id") ?? "").trim();
  const parentId = parentRaw === "" || parentRaw === TOP_LEVEL ? null : parentRaw;
  const documentId = String(formData.get("document_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (documentId && body) {
    return {
      error: "A section either points at a document or carries its own text. Choose one.",
    };
  }

  const supabase = await createClient();

  // Appended at the end of its level, so adding a section never reorders what
  // is already there. "Its level" means its siblings under the same parent —
  // PostgREST needs .is() for null and .eq() otherwise, which is why this is
  // built up rather than written as one chain.
  let siblingQuery = supabase
    .from("manual_sections")
    .select("sort_order")
    .eq("manual_id", manualId);

  siblingQuery =
    parentId === null
      ? siblingQuery.is("parent_id", null)
      : siblingQuery.eq("parent_id", parentId);

  const { data: siblings } = await siblingQuery
    .order("sort_order", { ascending: false })
    .limit(1);

  // Gaps of ten leave room to insert between two sections later without
  // rewriting the level.
  const nextOrder = (siblings?.[0]?.sort_order ?? 0) + 10;

  const { error } = await supabase.from("manual_sections").insert({
    manual_id: manualId,
    parent_id: parentId,
    heading,
    document_id: documentId || null,
    body: body || null,
    sort_order: nextOrder,
  });

  if (error) return { error: safeErrorMessage(error, "section") };

  revalidatePath(`/documents/manuals/${manualId}`);
  return { error: null };
}

export async function deleteManualSection(manualId: string, sectionId: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("docs_general")) {
    return { error: "You do not have permission to change manuals." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("manual_sections").delete().eq("id", sectionId);
  if (error) return { error: safeErrorMessage(error, "section") };

  revalidatePath(`/documents/manuals/${manualId}`);
  return { error: null };
}

/**
 * Moves a section up or down among its siblings.
 *
 * Swaps sort orders rather than renumbering the whole level, so two people
 * moving different sections at once cannot collide over one long update.
 */
export async function moveManualSection(
  manualId: string,
  sectionId: string,
  direction: "up" | "down",
) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("docs_general")) {
    return { error: "You do not have permission to change manuals." };
  }

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("manual_sections")
    .select("id, parent_id, sort_order")
    .eq("id", sectionId)
    .maybeSingle();

  if (!section) return { error: "That section no longer exists." };

  let query = supabase
    .from("manual_sections")
    .select("id, sort_order")
    .eq("manual_id", manualId);

  query =
    section.parent_id === null
      ? query.is("parent_id", null)
      : query.eq("parent_id", section.parent_id);

  const { data: siblings } = await query.order("sort_order");
  if (!siblings || siblings.length < 2) return { error: null };

  const index = siblings.findIndex((s) => s.id === sectionId);
  const swapWith = direction === "up" ? siblings[index - 1] : siblings[index + 1];
  // Already at the end of its level; nothing to do and nothing to report.
  if (!swapWith) return { error: null };

  // Two updates rather than an upsert: an upsert would need every not-null
  // column of both rows, which means reading and rewriting content this
  // function has no business touching.
  const [moved, displaced] = await Promise.all([
    supabase
      .from("manual_sections")
      .update({ sort_order: swapWith.sort_order })
      .eq("id", section.id),
    supabase
      .from("manual_sections")
      .update({ sort_order: section.sort_order })
      .eq("id", swapWith.id),
  ]);

  const error = moved.error ?? displaced.error;
  if (error) return { error: safeErrorMessage(error, "section") };

  revalidatePath(`/documents/manuals/${manualId}`);
  return { error: null };
}

export async function deleteManual(manualId: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("docs_general")) {
    return { error: "You do not have permission to delete manuals." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("manuals").delete().eq("id", manualId);
  if (error) return { error: safeErrorMessage(error, "manual") };

  revalidatePath("/documents");
  return { error: null };
}
