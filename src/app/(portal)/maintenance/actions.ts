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

  const planItemId = String(formData.get("plan_item_id") ?? "").trim();

  const { data: record, error } = await supabase.from("maintenance_records").insert({
    uav_id: uavId,
    // Null for an unscheduled repair, which satisfies no plan item.
    plan_item_id: planItemId || null,
    maintenance_type: maintenanceType,
    next_service_date: nextServiceDate || null,
    technician_id: technicianId || null,
    notes: notes || null,
    status: "scheduled",
  }).select("id, organisation_id").single();

  if (error) return { error: safeErrorMessage(error, "save") };

  if (record) {
    notify(
      "maintenance.due",
      {
        maintenance_id: record.id,
        uav_id: uavId,
        maintenance_type: maintenanceType,
        next_service_date: nextServiceDate || null,
      },
      record.organisation_id,
    );
  }

  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

export async function completeMaintenance(id: string) {
  const supabase = await createClient();

  const completedDate = new Date().toISOString().slice(0, 10);

  // Which aircraft, so the reading below is taken from the right one.
  const { data: existing } = await supabase
    .from("maintenance_records")
    .select("uav_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing?.uav_id) return { error: "That maintenance record no longer exists." };

  // Hours and cycles are read now and stored on the record. This is one of the
  // few figures the portal stores rather than derives, and deliberately: it is
  // a reading taken at a moment, and it is what every later interval counts
  // from. Without it "hours since service" silently means "hours since the
  // airframe entered service", which never resets and so never falls due.
  const [{ data: airframe }, { count: cycles }] = await Promise.all([
    supabase.from("uav_fleet_status").select("flight_hours").eq("uav_id", existing.uav_id).maybeSingle(),
    supabase
      .from("flight_logs")
      .select("id", { count: "exact", head: true })
      .eq("uav_id", existing.uav_id),
  ]);

  const { data: record, error } = await supabase
    .from("maintenance_records")
    .update({
      status: "completed",
      completed_date: completedDate,
      flight_hours_at_service: airframe?.flight_hours ?? null,
      cycles_at_service: cycles ?? null,
    })
    .eq("id", id)
    .select("uav_id, maintenance_type, next_service_date, organisation_id")
    .maybeSingle();

  if (error) return { error: safeErrorMessage(error, "update") };

  if (record) {
    notify(
      "maintenance.completed",
      {
        maintenance_id: id,
        uav_id: record.uav_id,
        maintenance_type: record.maintenance_type,
        completed_date: completedDate,
        next_service_date: record.next_service_date,
      },
      record.organisation_id,
    );
  }

  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}
