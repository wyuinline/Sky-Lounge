"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";

const UAV_STATUSES = ["airworthy", "maintenance", "grounded", "retired"] as const;

type UavFields = {
  drone_id: string;
  model: string;
  manufacturer: string | null;
  firmware_version: string | null;
  status: (typeof UAV_STATUSES)[number];
  next_inspection_date: string | null;
  registration_number: string | null;
  serial_number: string | null;
  weight_kg: number | null;
  purchased_date: string | null;
  location_site: string | null;
  notes: string | null;
  maintenance_interval_hours: number | null;
  baseline_flight_hours: number;
};

/**
 * Reads and validates the airframe form, shared by add and edit so the two
 * cannot drift into accepting different data.
 */
function readUavForm(formData: FormData): { error: string } | { error: null; fields: UavFields } {
  const droneId = String(formData.get("drone_id") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const firmwareVersion = String(formData.get("firmware_version") ?? "").trim();
  const status = parseEnum(formData.get("status"), UAV_STATUSES, "airworthy");
  const nextInspectionDate = String(formData.get("next_inspection_date") ?? "");
  const registrationNumber = String(formData.get("registration_number") ?? "").trim();
  const serialNumber = String(formData.get("serial_number") ?? "").trim();
  const weightRaw = String(formData.get("weight_kg") ?? "").trim();
  const purchasedDate = String(formData.get("purchased_date") ?? "");
  const locationSite = String(formData.get("location_site") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const intervalRaw = String(formData.get("maintenance_interval_hours") ?? "").trim();
  const baselineRaw = String(formData.get("baseline_flight_hours") ?? "").trim();

  if (!droneId || !model) {
    return { error: "Drone ID and model are required." };
  }

  const weightKg = weightRaw === "" ? null : Number(weightRaw);
  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0)) {
    return { error: "Weight must be a number greater than zero." };
  }

  const intervalHours = intervalRaw === "" ? null : Number(intervalRaw);
  if (intervalHours !== null && (!Number.isInteger(intervalHours) || intervalHours <= 0)) {
    return { error: "Maintenance interval must be a whole number of hours." };
  }

  // Transport Canada requires registration for airframes from 250 g to 25 kg,
  // so flag a missing registration rather than silently accepting it.
  if (weightKg !== null && weightKg >= 0.25 && weightKg <= 25 && !registrationNumber) {
    return {
      error: "Aircraft between 250 g and 25 kg must be registered. Add the registration number.",
    };
  }

  const baselineHours = baselineRaw === "" ? 0 : Number(baselineRaw);
  if (!Number.isFinite(baselineHours) || baselineHours < 0) {
    return { error: "Existing flight hours must be zero or more." };
  }

  return {
    error: null,
    fields: {
      drone_id: droneId,
      model,
      manufacturer: manufacturer || null,
      firmware_version: firmwareVersion || null,
      status,
      next_inspection_date: nextInspectionDate || null,
      registration_number: registrationNumber || null,
      serial_number: serialNumber || null,
      weight_kg: weightKg,
      purchased_date: purchasedDate || null,
      location_site: locationSite || null,
      notes: notes || null,
      maintenance_interval_hours: intervalHours,
      baseline_flight_hours: baselineHours,
    },
  };
}

async function requireFleetManager() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const };
  if (!access.canManage("fleet")) {
    return { error: "You do not have permission to change the fleet." as const };
  }
  return { error: null };
}

export async function addUav(formData: FormData) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };

  const parsed = readUavForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("uavs").insert(parsed.fields);

  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

export async function updateUav(uavId: string, formData: FormData) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!uavId) return { error: "No airframe selected." };

  const parsed = readUavForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("uavs")
    .update(parsed.fields, { count: "exact" })
    .eq("id", uavId);

  if (error) return { error: safeErrorMessage(error, "update") };
  // Zero rows means it was deleted underneath us, or RLS declined silently.
  if (count === 0) return { error: "That airframe no longer exists. Refresh and try again." };

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

/**
 * Takes an airframe out of service without touching its history.
 *
 * This is the usual end of an airframe's life in the portal. Deleting one that
 * has flown is not possible and should not be: the logs and servicing records
 * pointing at it are the compliance record.
 */
export async function setUavRetired(uavId: string, retired: boolean) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!uavId) return { error: "No airframe selected." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("uavs")
    .update({ status: retired ? "retired" : "grounded" })
    .eq("id", uavId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

/**
 * Removes an airframe entirely — only possible while nothing references it.
 *
 * For genuine mistakes: a duplicate entry, a typo'd row added twice. The
 * foreign keys refuse anything else, and that refusal is translated here into
 * a message that points at retiring instead.
 */
export async function deleteUav(uavId: string) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!uavId) return { error: "No airframe selected." };

  const supabase = await createClient();
  const { error } = await supabase.from("uavs").delete().eq("id", uavId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This airframe has flights, servicing, or incidents recorded against it, and that history has to be kept. Retire it instead.",
      };
    }
    return { error: safeErrorMessage(error, "delete") };
  }

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}
