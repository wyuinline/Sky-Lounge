"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function logMaintenance(formData: FormData) {
  const supabase = await createClient();

  const uavId = String(formData.get("uav_id") ?? "");
  const maintenanceType = String(formData.get("maintenance_type") ?? "preventive");
  const nextServiceDate = String(formData.get("next_service_date") ?? "");
  const technicianId = String(formData.get("technician_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!uavId) {
    return { error: "UAV is required." };
  }

  const { error } = await supabase.from("maintenance_records").insert({
    uav_id: uavId,
    maintenance_type: maintenanceType,
    next_service_date: nextServiceDate || null,
    technician_id: technicianId || null,
    notes: notes || null,
    status: "scheduled",
  });

  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

export async function completeMaintenance(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("maintenance_records")
    .update({ status: "completed", completed_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}
