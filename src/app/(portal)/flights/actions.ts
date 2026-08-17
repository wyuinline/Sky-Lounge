"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitFlightRequest(formData: FormData) {
  const supabase = await createClient();

  const pilotId = String(formData.get("pilot_id") ?? "");
  const uavId = String(formData.get("uav_id") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const requestedDate = String(formData.get("requested_date") ?? "");
  const riskLevel = String(formData.get("risk_level") ?? "low");
  const riskAssessment = String(formData.get("risk_assessment") ?? "").trim();

  if (!pilotId || !uavId || !requestedDate) {
    return { error: "Pilot, UAV, and requested date are required." };
  }

  const { error } = await supabase.from("flight_requests").insert({
    pilot_id: pilotId,
    uav_id: uavId,
    location: location || null,
    requested_date: requestedDate,
    risk_level: riskLevel,
    risk_assessment: riskAssessment || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/flights");
  return { error: null };
}

export async function updateFlightRequestStatus(id: string, status: "approved" | "rejected") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("flight_requests")
    .update({ approval_status: status, approved_by: user?.id ?? null })
    .eq("id", id);

  if (error) return { error: error.message };

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
  const missionOutcome = String(formData.get("mission_outcome") ?? "completed");

  if (!pilotId || !uavId || !flightDate) {
    return { error: "Pilot, UAV, and flight date are required." };
  }

  const { error } = await supabase.from("flight_logs").insert({
    pilot_id: pilotId,
    uav_id: uavId,
    flight_date: flightDate,
    duration_minutes: durationMinutes || null,
    weather_conditions: weatherConditions || null,
    mission_outcome: missionOutcome,
  });

  if (error) return { error: error.message };

  revalidatePath("/flights");
  revalidatePath("/");
  return { error: null };
}
