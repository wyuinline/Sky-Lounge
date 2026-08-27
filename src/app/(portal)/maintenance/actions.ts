"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { notify } from "@/lib/webhook-dispatch";

const MAINTENANCE_TYPES = ["preventive", "repair", "calibration", "battery", "firmware"] as const;

export async function logMaintenance(formData: FormData) {
  const supabase = await createClient();

  const uavId = String(formData.get("uav_id") ?? "");
  const maintenanceType = parseEnum(
    formData.get("maintenance_type"),
    MAINTENANCE_TYPES,
    "preventive",
  );
  const nextServiceDate = String(formData.get("next_service_date") ?? "");
  const technicianId = String(formData.get("technician_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!uavId) {
    return { error: "Choose the UAV this record applies to." };
  }

  const { data: record, error } = await supabase.from("maintenance_records").insert({
    uav_id: uavId,
    maintenance_type: maintenanceType,
    next_service_date: nextServiceDate || null,
    technician_id: technicianId || null,
    notes: notes || null,
    status: "scheduled",
  }).select("id").single();

  if (error) return { error: safeErrorMessage(error, "save") };

  notify("maintenance.due", {
    maintenance_id: record?.id ?? null,
    uav_id: uavId,
    maintenance_type: maintenanceType,
    next_service_date: nextServiceDate || null,
  });

  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

export async function completeMaintenance(id: string) {
  const supabase = await createClient();

  const completedDate = new Date().toISOString().slice(0, 10);
  const { data: record, error } = await supabase
    .from("maintenance_records")
    .update({ status: "completed", completed_date: completedDate })
    .eq("id", id)
    .select("uav_id, maintenance_type, next_service_date")
    .maybeSingle();

  if (error) return { error: safeErrorMessage(error, "update") };

  notify("maintenance.completed", {
    maintenance_id: id,
    uav_id: record?.uav_id ?? null,
    maintenance_type: record?.maintenance_type ?? null,
    completed_date: completedDate,
    next_service_date: record?.next_service_date ?? null,
  });

  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}
