"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addPilot(formData: FormData) {
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const licenseNumber = String(formData.get("license_number") ?? "").trim();
  const medicalExpiry = String(formData.get("medical_expiry") ?? "");

  if (!fullName) {
    return { error: "Full name is required." };
  }

  const { error } = await supabase.from("pilots").insert({
    full_name: fullName,
    employee_id: employeeId || null,
    license_number: licenseNumber || null,
    medical_expiry: medicalExpiry || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/pilots");
  revalidatePath("/");
  return { error: null };
}
