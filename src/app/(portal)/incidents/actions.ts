"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { notify } from "@/lib/webhook-dispatch";

const INCIDENT_TYPES = [
  "near_miss",
  "crash",
  "equipment_failure",
  "safety_hazard",
  "regulatory_breach",
] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const INCIDENT_STATUSES = ["investigating", "closed", "escalated"] as const;

export async function reportIncident(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const incidentDate = String(formData.get("incident_date") ?? "");
  const incidentType = parseEnum(formData.get("incident_type"), INCIDENT_TYPES, "near_miss");
  const uavId = String(formData.get("uav_id") ?? "");
  const pilotId = String(formData.get("pilot_id") ?? "");
  const severity = parseEnum(formData.get("severity"), SEVERITIES, "low");
  const description = String(formData.get("description") ?? "").trim();
  const isAnonymous = formData.get("is_anonymous") === "true";

  if (!incidentDate || !description) {
    return { error: "Add the incident date and a description." };
  }

  const { data: incident, error } = await supabase.from("incidents").insert({
    incident_date: incidentDate,
    incident_type: incidentType,
    uav_id: uavId || null,
    pilot_id: isAnonymous ? null : pilotId || null,
    severity,
    description,
    is_anonymous: isAnonymous,
    // Anonymous reports stay genuinely anonymous — no reporter recorded.
    // Named reports are attributable, so a false report can be traced.
    reported_by: isAnonymous ? null : (user?.id ?? null),
  }).select("id").single();

  if (error) return { error: safeErrorMessage(error, "report") };

  // Neither the reporter nor the pilot is named in the payload. An anonymous
  // channel that leaks identity through a Teams message is not anonymous.
  notify("incident.reported", {
    incident_id: incident?.id ?? null,
    incident_date: incidentDate,
    incident_type: incidentType,
    severity,
  });

  revalidatePath("/incidents");
  revalidatePath("/");
  return { error: null };
}

export async function updateIncidentStatus(
  id: string,
  status: (typeof INCIDENT_STATUSES)[number],
) {
  const supabase = await createClient();
  const safeStatus = parseEnum(status, INCIDENT_STATUSES, "investigating");

  const { error } = await supabase.from("incidents").update({ status: safeStatus }).eq("id", id);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/incidents");
  revalidatePath("/");
  return { error: null };
}
