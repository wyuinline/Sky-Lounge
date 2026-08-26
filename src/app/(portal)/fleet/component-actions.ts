"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { todayIso } from "@/lib/compliance";

const COMPONENT_CATEGORIES = [
  "motor",
  "propeller",
  "esc",
  "gimbal",
  "camera",
  "payload",
  "rtk_base",
  "controller",
  "antenna",
  "charger",
  "case",
  "other",
] as const;

const COMPONENT_STATUSES = ["in_service", "spare", "maintenance", "retired"] as const;

async function requireFleetManager() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const, userId: null };
  if (!access.canManage("fleet")) {
    return { error: "You do not have permission to change the fleet." as const, userId: null };
  }
  return { error: null, userId: access.userId };
}

type ComponentFields = {
  component_id: string;
  category: (typeof COMPONENT_CATEGORIES)[number];
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  purchased_date: string | null;
  baseline_hours: number;
  service_interval_hours: number | null;
  status: (typeof COMPONENT_STATUSES)[number];
  location_site: string | null;
  notes: string | null;
};

function readComponentForm(
  formData: FormData,
): { error: string } | { error: null; fields: ComponentFields } {
  const componentId = String(formData.get("component_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = parseEnum(formData.get("category"), COMPONENT_CATEGORIES, "other");
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const serialNumber = String(formData.get("serial_number") ?? "").trim();
  const purchasedDate = String(formData.get("purchased_date") ?? "");
  const baselineRaw = String(formData.get("baseline_hours") ?? "").trim();
  const intervalRaw = String(formData.get("service_interval_hours") ?? "").trim();
  const status = parseEnum(formData.get("status"), COMPONENT_STATUSES, "spare");
  const locationSite = String(formData.get("location_site") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!componentId) return { error: "Give the part an asset tag." };
  if (!name) return { error: "Give the part a name — what it is, in plain words." };

  const baselineHours = baselineRaw === "" ? 0 : Number(baselineRaw);
  if (!Number.isFinite(baselineHours) || baselineHours < 0) {
    return { error: "Existing hours must be zero or more." };
  }

  const interval = intervalRaw === "" ? null : Number(intervalRaw);
  if (interval !== null && (!Number.isInteger(interval) || interval <= 0)) {
    return { error: "The service interval must be a whole number of hours." };
  }
  if (interval !== null && interval < baselineHours) {
    return { error: "The service interval is below the hours already on this part. Check both." };
  }

  return {
    error: null,
    fields: {
      component_id: componentId,
      category,
      name,
      manufacturer: manufacturer || null,
      model: model || null,
      serial_number: serialNumber || null,
      purchased_date: purchasedDate || null,
      baseline_hours: baselineHours,
      service_interval_hours: interval,
      status,
      location_site: locationSite || null,
      notes: notes || null,
    },
  };
}

export async function addComponent(formData: FormData) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };

  const parsed = readComponentForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("components").insert(parsed.fields);
  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/fleet");
  return { error: null };
}

export async function updateComponent(componentId: string, formData: FormData) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!componentId) return { error: "No part selected." };

  const parsed = readComponentForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("components")
    .update(parsed.fields, { count: "exact" })
    .eq("id", componentId);

  if (error) return { error: safeErrorMessage(error, "update") };
  if (count === 0) return { error: "That part no longer exists. Refresh and try again." };

  revalidatePath("/fleet");
  return { error: null };
}

/**
 * Fits a part to an airframe.
 *
 * From this date the part accrues that aircraft's flight hours, so fitting is
 * not a label — it is what makes the hours real. A partial unique index in the
 * database refuses a second open installation, since a part fitted to two
 * aircraft at once would double-count every hour flown.
 */
export async function installComponent(
  componentId: string,
  uavId: string,
  installedOn: string,
) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!componentId || !uavId) return { error: "Choose a part and an airframe." };

  const date = installedOn || todayIso();
  if (date > todayIso()) return { error: "A part cannot be fitted on a future date." };

  const supabase = await createClient();

  const { error } = await supabase.from("component_installations").insert({
    component_id: componentId,
    uav_id: uavId,
    installed_on: date,
    installed_by: guard.userId,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "That part is already fitted to an airframe. Remove it before fitting it elsewhere.",
      };
    }
    return { error: safeErrorMessage(error, "installation") };
  }

  // A fitted part is in service by definition.
  await supabase.from("components").update({ status: "in_service" }).eq("id", componentId);

  revalidatePath("/fleet");
  return { error: null };
}

/**
 * Takes a part off the aircraft, closing the period its hours accrue over.
 */
export async function removeComponent(componentId: string, removedOn: string) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!componentId) return { error: "No part selected." };

  const date = removedOn || todayIso();
  if (date > todayIso()) return { error: "A part cannot be removed on a future date." };

  const supabase = await createClient();

  const { data: open } = await supabase
    .from("component_installations")
    .select("id, installed_on")
    .eq("component_id", componentId)
    .is("removed_on", null)
    .maybeSingle();

  if (!open) return { error: "That part is not currently fitted to anything." };
  if (date < open.installed_on) {
    return { error: `It was fitted on ${open.installed_on}. Removal cannot be earlier than that.` };
  }

  const { error } = await supabase
    .from("component_installations")
    .update({ removed_on: date })
    .eq("id", open.id);

  if (error) return { error: safeErrorMessage(error, "removal") };

  await supabase.from("components").update({ status: "spare" }).eq("id", componentId);

  revalidatePath("/fleet");
  return { error: null };
}

export async function setComponentStatus(componentId: string, status: string) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };

  const next = parseEnum(status, COMPONENT_STATUSES, "spare");
  if (next !== status) return { error: "That is not a component status this portal recognises." };

  const supabase = await createClient();

  // Retiring a part that is still on an aircraft would leave it accruing hours
  // it should not have, so the installation is closed first.
  if (next === "retired") {
    await supabase
      .from("component_installations")
      .update({ removed_on: todayIso() })
      .eq("component_id", componentId)
      .is("removed_on", null);
  }

  const { error } = await supabase.from("components").update({ status: next }).eq("id", componentId);
  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/fleet");
  return { error: null };
}

export async function deleteComponent(componentId: string) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!componentId) return { error: "No part selected." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("component_installations")
    .select("id", { count: "exact", head: true })
    .eq("component_id", componentId);

  if ((count ?? 0) > 0) {
    return {
      error:
        "This part has been fitted to an airframe, and that is part of its service history. Retire it instead.",
    };
  }

  const { error } = await supabase.from("components").delete().eq("id", componentId);
  if (error) return { error: safeErrorMessage(error, "delete") };

  revalidatePath("/fleet");
  return { error: null };
}
