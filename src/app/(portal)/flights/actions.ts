"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
const MISSION_OUTCOMES = ["completed", "aborted", "partial"] as const;
const APPROVAL_DECISIONS = ["approved", "rejected"] as const;

export async function submitFlightRequest(formData: FormData) {
  const supabase = await createClient();

  const pilotId = String(formData.get("pilot_id") ?? "");
  const uavId = String(formData.get("uav_id") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const requestedDate = String(formData.get("requested_date") ?? "");
  const riskLevel = parseEnum(formData.get("risk_level"), RISK_LEVELS, "low");
  const riskAssessment = String(formData.get("risk_assessment") ?? "").trim();

  if (!pilotId || !uavId || !requestedDate) {
    return { error: "Choose a pilot and UAV, and set the requested date." };
  }

  const { error } = await supabase.from("flight_requests").insert({
    pilot_id: pilotId,
    uav_id: uavId,
    location: location || null,
    requested_date: requestedDate,
    risk_level: riskLevel,
    risk_assessment: riskAssessment || null,
  });

  if (error) return { error: safeErrorMessage(error, "request") };

  revalidatePath("/flights");
  return { error: null };
}

export async function updateFlightRequestStatus(
  id: string,
  status: (typeof APPROVAL_DECISIONS)[number],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const safeStatus = parseEnum(status, APPROVAL_DECISIONS, "rejected");

  const { error } = await supabase
    .from("flight_requests")
    .update({ approval_status: safeStatus, approved_by: user?.id ?? null })
    .eq("id", id);

  if (error) return { error: safeErrorMessage(error, "approval") };

  revalidatePath("/flights");
  return { error: null };
}

export async function logFlight(formData: FormData) {
  const supabase = await createClient();

  const pilotId = String(formData.get("pilot_id") ?? "");
  const uavId = String(formData.get("uav_id") ?? "");
  const flightDate = String(formData.get("flight_date") ?? "");
  const durationMinutes = Number(formData.get("duration_minutes") ?? 0);
  const weatherConditions = String(formData.get("weather_conditions") ?? "").trim();
  const missionOutcome = parseEnum(
    formData.get("mission_outcome"),
    MISSION_OUTCOMES,
    "completed",
  );

  if (!pilotId || !uavId || !flightDate) {
    return { error: "Choose a pilot and UAV, and set the flight date." };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    return { error: "Duration must be zero or more minutes." };
  }

  const { error } = await supabase.from("flight_logs").insert({
    pilot_id: pilotId,
    uav_id: uavId,
    flight_date: flightDate,
    duration_minutes: durationMinutes || null,
    weather_conditions: weatherConditions || null,
    mission_outcome: missionOutcome,
  });

  if (error) return { error: safeErrorMessage(error, "flight log") };

  revalidatePath("/flights");
  revalidatePath("/");
  return { error: null };
}

/**
 * Clears the "newly filed" flag on a flight log.
 *
 * Logs have no approval workflow — they are a record of what happened, not a
 * request — so this is the one attention flag in the portal that has to be
 * stored rather than derived. Acknowledging says only "I have seen this"; it
 * does not change the log.
 */
export async function acknowledgeFlightLog(logId: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("logs")) {
    return { error: "You do not have permission to review flight logs." };
  }
  if (!logId) return { error: "No log selected." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("flight_logs")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: access.userId })
    .eq("id", logId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/flights");
  revalidatePath("/");
  return { error: null };
}
