"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";

const UAV_STATUSES = ["airworthy", "maintenance", "grounded"] as const;

export async function addUav(formData: FormData) {
  const supabase = await createClient();

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

  const { error } = await supabase.from("uavs").insert({
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
  });

  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}
