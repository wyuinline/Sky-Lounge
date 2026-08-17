"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function uploadCertification(formData: FormData) {
  const supabase = await createClient();

  const pilotId = String(formData.get("pilot_id") ?? "");
  const certificationName = String(formData.get("certification_name") ?? "").trim();
  const issueDate = String(formData.get("issue_date") ?? "");
  const expiryDate = String(formData.get("expiry_date") ?? "");
  const competencyLevel = String(formData.get("competency_level") ?? "beginner");

  if (!pilotId || !certificationName) {
    return { error: "Pilot and certification name are required." };
  }

  const { error } = await supabase.from("training_records").insert({
    pilot_id: pilotId,
    certification_name: certificationName,
    issue_date: issueDate || null,
    expiry_date: expiryDate || null,
    competency_level: competencyLevel,
  });

  if (error) return { error: error.message };

  revalidatePath("/training");
  revalidatePath("/pilots");
  revalidatePath("/");
  return { error: null };
}
