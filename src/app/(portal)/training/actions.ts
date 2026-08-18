"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";

const COMPETENCY_LEVELS = ["beginner", "intermediate", "advanced", "qualified"] as const;

export async function uploadCertification(formData: FormData) {
  const supabase = await createClient();

  const pilotId = String(formData.get("pilot_id") ?? "");
  const certificationName = String(formData.get("certification_name") ?? "").trim();
  const issueDate = String(formData.get("issue_date") ?? "");
  const expiryDate = String(formData.get("expiry_date") ?? "");
  const competencyLevel = parseEnum(
    formData.get("competency_level"),
    COMPETENCY_LEVELS,
    "beginner",
  );

  if (!pilotId || !certificationName) {
    return { error: "Choose a pilot and enter the certification name." };
  }
  if (issueDate && expiryDate && expiryDate < issueDate) {
    return { error: "The expiry date can't be before the issue date." };
  }

  const { error } = await supabase.from("training_records").insert({
    pilot_id: pilotId,
    certification_name: certificationName,
    issue_date: issueDate || null,
    expiry_date: expiryDate || null,
    competency_level: competencyLevel,
  });

  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/training");
  revalidatePath("/pilots");
  revalidatePath("/");
  return { error: null };
}
