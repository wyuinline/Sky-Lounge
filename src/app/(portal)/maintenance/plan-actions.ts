"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";

/**
 * Inspection plans.
 *
 * A plan is a list of items, each with its own clock. Nothing here computes a
 * due date — the view derives every due point from the intervals set here and
 * the completions recorded against them, so correcting an interval corrects
 * every aircraft's schedule at once.
 */

/** Reads and validates the three intervals. At least one must be given. */
function readIntervals(formData: FormData, prefix = ""): {
  interval_hours: number | null;
  interval_cycles: number | null;
  interval_months: number | null;
  error: string | null;
} {
  const read = (name: string): number | null => {
    const raw = String(formData.get(`${prefix}${name}`) ?? "").trim();
    if (raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : Number.NaN;
  };

  const hours = read("interval_hours");
  const cycles = read("interval_cycles");
  const months = read("interval_months");

  const blank = { interval_hours: null, interval_cycles: null, interval_months: null };

  for (const [value, label] of [
    [hours, "Hours"],
    [cycles, "Flights"],
    [months, "Months"],
  ] as const) {
    if (value !== null && (Number.isNaN(value) || value <= 0)) {
      return { ...blank, error: `${label} must be a number greater than zero.` };
    }
  }

  if (hours === null && cycles === null && months === null) {
    return {
      ...blank,
      // Matches the database's own constraint, said the way a person would.
      error: "Give at least one interval — hours, flights or months.",
    };
  }

  if (
    (cycles !== null && !Number.isInteger(cycles)) ||
    (months !== null && !Number.isInteger(months))
  ) {
    return { ...blank, error: "Flights and months must be whole numbers." };
  }

  return {
    interval_hours: hours,
    interval_cycles: cycles,
    interval_months: months,
    error: null,
  };
}

export async function createInspectionPlan(formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("maintenance")) {
    return { error: "You do not have permission to create inspection plans." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the plan a name." };

  const model = String(formData.get("applies_to_model") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.from("inspection_plans").insert({
    name,
    // A blank model means the plan is assigned aircraft by aircraft rather
    // than reaching every airframe of a type.
    applies_to_model: model || null,
    description: description || null,
    created_by: access.userId,
  });

  if (error) return { error: safeErrorMessage(error, "inspection plan") };

  revalidatePath("/maintenance");
  return { error: null };
}

export async function addPlanItem(planId: string, formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("maintenance")) {
    return { error: "You do not have permission to change inspection plans." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name the item — what is actually being inspected." };

  const intervals = readIntervals(formData);
  if (intervals.error) return { error: intervals.error };

  const description = String(formData.get("description") ?? "").trim();
  const isCritical = formData.get("is_critical") === "on";
  const sortRaw = String(formData.get("sort_order") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.from("inspection_plan_items").insert({
    plan_id: planId,
    name,
    description: description || null,
    interval_hours: intervals.interval_hours,
    interval_cycles: intervals.interval_cycles,
    interval_months: intervals.interval_months,
    is_critical: isCritical,
    sort_order: sortRaw === "" ? 0 : Number(sortRaw),
  });

  if (error) return { error: safeErrorMessage(error, "plan item") };

  revalidatePath("/maintenance");
  return { error: null };
}

export async function deletePlanItem(itemId: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("maintenance")) {
    return { error: "You do not have permission to change inspection plans." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inspection_plan_items").delete().eq("id", itemId);
  if (error) return { error: safeErrorMessage(error, "plan item") };

  revalidatePath("/maintenance");
  return { error: null };
}

export async function setPlanActive(planId: string, active: boolean) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("maintenance")) {
    return { error: "You do not have permission to change inspection plans." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inspection_plans").update({ active }).eq("id", planId);
  if (error) return { error: safeErrorMessage(error, "inspection plan") };

  revalidatePath("/maintenance");
  return { error: null };
}

/**
 * Assigns or unassigns a plan to one aircraft.
 *
 * Separate from the model match, so an airframe carrying a different payload
 * can be put on its own schedule without inventing a model name for it.
 */
export async function setPlanAssignment(planId: string, uavId: string, assigned: boolean) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("maintenance")) {
    return { error: "You do not have permission to change inspection plans." };
  }

  const supabase = await createClient();
  const { error } = assigned
    ? await supabase
        .from("uav_inspection_plans")
        .upsert({ plan_id: planId, uav_id: uavId }, { onConflict: "uav_id,plan_id" })
    : await supabase
        .from("uav_inspection_plans")
        .delete()
        .eq("plan_id", planId)
        .eq("uav_id", uavId);

  if (error) return { error: safeErrorMessage(error, "plan assignment") };

  revalidatePath("/maintenance");
  return { error: null };
}
