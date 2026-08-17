"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addUav(formData: FormData) {
  const supabase = await createClient();

  const droneId = String(formData.get("drone_id") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const firmwareVersion = String(formData.get("firmware_version") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  const nextInspectionDate = String(formData.get("next_inspection_date") ?? "");

  if (!droneId || !model) {
    return { error: "Drone ID and model are required." };
  }

  const { error } = await supabase.from("uavs").insert({
    drone_id: droneId,
    model,
    manufacturer: manufacturer || null,
    firmware_version: firmwareVersion || null,
    status,
    next_inspection_date: nextInspectionDate || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}
