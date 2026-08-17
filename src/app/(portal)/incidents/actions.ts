"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reportIncident(formData: FormData) {
  const supabase = await createClient();

  const incidentDate = String(formData.get("incident_date") ?? "");
  const incidentType = String(formData.get("incident_type") ?? "near_miss");
  const uavId = String(formData.get("uav_id") ?? "");
  const pilotId = String(formData.get("pilot_id") ?? "");
  const severity = String(formData.get("severity") ?? "low");
  const description = String(formData.get("description") ?? "").trim();
  const isAnonymous = formData.get("is_anonymous") === "true";

  if (!incidentDate || !description) {
    return { error: "Incident date and description are required." };
  }

  const { error } = await supabase.from("incidents").insert({
    incident_date: incidentDate,
    incident_type: incidentType,
    uav_id: uavId || null,
    pilot_id: isAnonymous ? null : pilotId || null,
    severity,
    description,
    is_anonymous: isAnonymous,
  });

  if (error) return { error: error.message };

  revalidatePath("/incidents");
  revalidatePath("/");
  return { error: null };
}

export async function updateIncidentStatus(id: string, status: "investigating" | "closed" | "escalated") {
  const supabase = await createClient();

  const { error } = await supabase.from("incidents").update({ status }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/incidents");
  revalidatePath("/");
  return { error: null };
}
