"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { todayIso } from "@/lib/compliance";
import {
  checkAuthorisations,
  refusalMessage,
  operationOrder,
  type OperationType,
} from "@/lib/operations";

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
const MISSION_OUTCOMES = ["completed", "aborted", "partial"] as const;
const APPROVAL_DECISIONS = ["approved", "rejected"] as const;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Refuses an aircraft that is not fit to fly.
 *
 * The portal has flagged overdue inspections for a while, but a flag is a
 * suggestion — a request could still be raised and approved against a grounded
 * airframe. This turns the warning into a control, at the point where it
 * matters: nothing is booked onto an aircraft that is out of service, past its
 * calendar inspection, or past its hours interval.
 *
 * Returns a reason to show the requester, or null when the aircraft is fit.
 */
async function airworthinessRefusal(
  supabase: Supabase,
  uavId: string,
): Promise<string | null> {
  const { data: uav } = await supabase
    .from("uav_fleet_status")
    .select("drone_id, status, next_inspection_date, hours_until_service")
    .eq("id", uavId)
    .maybeSingle();

  if (!uav) return "That aircraft no longer exists. Refresh and try again.";

  const name = uav.drone_id ?? "That aircraft";

  if (uav.status === "retired") {
    return `${name} has been retired from the fleet and cannot be booked.`;
  }
  if (uav.status === "grounded") {
    return `${name} is grounded. Return it to service before booking a flight.`;
  }
  if (uav.status === "maintenance") {
    return `${name} is in maintenance. Complete the service before booking a flight.`;
  }

  const today = todayIso();
  if (uav.next_inspection_date && uav.next_inspection_date < today) {
    return `${name} was due for inspection on ${uav.next_inspection_date}. Complete it before booking a flight.`;
  }
  if (uav.hours_until_service !== null && uav.hours_until_service <= 0) {
    return `${name} has passed its hours-based service interval. Complete the service before booking a flight.`;
  }

  return null;
}

/**
 * Refuses a pilot who is not cleared for what the flight is doing.
 *
 * A current certificate says a pilot may fly; an authorisation says what they
 * may fly. The portal has checked the first since the beginning and could not
 * check the second, because nothing on a request said which rules the flight
 * was operating under.
 *
 * Returns a reason to show the requester, or null when the pilot is cleared.
 */
async function authorisationRefusal(
  supabase: Supabase,
  pilotId: string,
  operations: OperationType[],
): Promise<string | null> {
  if (operations.length === 0) return null;

  const [{ data: pilot }, { data: held }] = await Promise.all([
    supabase.from("pilots").select("full_name").eq("id", pilotId).maybeSingle(),
    supabase
      .from("pilot_authorisation_status")
      .select("operation, currently_valid")
      .eq("pilot_id", pilotId),
  ]);

  if (!pilot) return "That pilot no longer exists. Refresh and try again.";

  const verdict = checkAuthorisations(
    operations,
    (held ?? []).map((h) => ({
      operation: h.operation as OperationType,
      currently_valid: h.currently_valid ?? false,
    })),
  );

  return refusalMessage(pilot.full_name, verdict);
}

/** The operation types submitted with a request, filtered to ones we know. */
function readOperations(formData: FormData): OperationType[] {
  const raw = formData.getAll("operations").map(String);
  return operationOrder.filter((o) => raw.includes(o));
}

export async function submitFlightRequest(formData: FormData) {
  const supabase = await createClient();

  const pilotId = String(formData.get("pilot_id") ?? "");
  const uavId = String(formData.get("uav_id") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const requestedDate = String(formData.get("requested_date") ?? "");
  const riskLevel = parseEnum(formData.get("risk_level"), RISK_LEVELS, "low");
  const riskAssessment = String(formData.get("risk_assessment") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const airspaceAuth = String(formData.get("airspace_authorisation") ?? "").trim();
  const airspaceAuthExpires = String(formData.get("airspace_authorisation_expires") ?? "");

  if (!pilotId || !uavId || !requestedDate) {
    return { error: "Choose a pilot and UAV, and set the requested date." };
  }

  const refusal = await airworthinessRefusal(supabase, uavId);
  if (refusal) return { error: refusal };

  // Every flight is at least VLOS, so an empty selection still checks the
  // baseline rather than waving the request through unexamined.
  const operations = readOperations(formData);
  const effectiveOperations = operations.length > 0 ? operations : (["vlos"] as OperationType[]);

  const authRefusal = await authorisationRefusal(supabase, pilotId, effectiveOperations);
  if (authRefusal) return { error: authRefusal };

  const { error } = await supabase.from("flight_requests").insert({
    pilot_id: pilotId,
    uav_id: uavId,
    location: location || null,
    requested_date: requestedDate,
    risk_level: riskLevel,
    risk_assessment: riskAssessment || null,
    project_id: projectId || null,
    airspace_authorisation: airspaceAuth || null,
    airspace_authorisation_expires: airspaceAuthExpires || null,
    operations: effectiveOperations,
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

  // Checked again at approval, not only at submission: a request can sit in
  // the queue for a week, and the aircraft can go out of service in that time.
  // Rejecting is always allowed — refusing to let someone reject a booking on a
  // grounded aircraft would be exactly backwards.
  if (safeStatus === "approved") {
    const { data: request } = await supabase
      .from("flight_requests")
      .select("uav_id, pilot_id, operations")
      .eq("id", id)
      .maybeSingle();

    if (!request?.uav_id) return { error: "That request no longer exists." };

    const refusal = await airworthinessRefusal(supabase, request.uav_id);
    if (refusal) return { error: refusal };

    // An authorisation can lapse while a request waits in the queue, exactly
    // as an aircraft can go out of service.
    if (request.pilot_id) {
      const authRefusal = await authorisationRefusal(
        supabase,
        request.pilot_id,
        (request.operations ?? []) as OperationType[],
      );
      if (authRefusal) return { error: authRefusal };
    }
  }

  const { error } = await supabase
    .from("flight_requests")
    .update({ approval_status: safeStatus, approved_by: user?.id ?? null })
    .eq("id", id);

  if (error) return { error: safeErrorMessage(error, "approval") };

  revalidatePath("/flights");
  return { error: null };
}

const AIRSPACE_CLASSES = ["uncontrolled", "controlled", "restricted", "advisory"] as const;

/** A hidden numeric field from the weather lookup, or null if absent. */
function numberField(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Parses "HH:MM" against the flight date into a timestamp, or null. */
function combineDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function logFlight(formData: FormData) {
  const pilotId = String(formData.get("pilot_id") ?? "");
  const uavId = String(formData.get("uav_id") ?? "");
  const flightDate = String(formData.get("flight_date") ?? "");
  const durationRaw = String(formData.get("duration_minutes") ?? "").trim();
  const weatherConditions = String(formData.get("weather_conditions") ?? "").trim();
  const missionOutcome = parseEnum(
    formData.get("mission_outcome"),
    MISSION_OUTCOMES,
    "completed",
  );

  const takeoffTime = String(formData.get("takeoff_time") ?? "").trim();
  const landingTime = String(formData.get("landing_time") ?? "").trim();
  const locationName = String(formData.get("location_name") ?? "").trim();
  const latRaw = String(formData.get("latitude") ?? "").trim();
  const lngRaw = String(formData.get("longitude") ?? "").trim();
  const altRaw = String(formData.get("max_altitude_m") ?? "").trim();
  const airspaceRaw = String(formData.get("airspace") ?? "").trim();
  const sfocReference = String(formData.get("sfoc_reference") ?? "").trim();

  const isNight = formData.get("is_night") === "on";
  const isBvlos = formData.get("is_bvlos") === "on";
  const isOverPeople = formData.get("is_over_people") === "on";
  const isSheltered = formData.get("is_sheltered") === "on";

  const projectId = String(formData.get("project_id") ?? "").trim();
  const weatherStation = String(formData.get("weather_station") ?? "").trim().toUpperCase();
  const weatherRaw = String(formData.get("weather_raw") ?? "").trim();
  const weatherObservedAt = String(formData.get("weather_observed_at") ?? "").trim();
  const flightCategoryRaw = String(formData.get("flight_category") ?? "").trim();
  const batteryIds = formData.getAll("battery_ids").map(String).filter(Boolean);
  const observerIds = formData.getAll("observer_ids").map(String).filter(Boolean);

  if (!pilotId || !uavId || !flightDate) {
    return { error: "Choose a pilot and UAV, and set the flight date." };
  }

  const takeoffAt = combineDateTime(flightDate, takeoffTime);
  const landingAt = combineDateTime(flightDate, landingTime);

  if (takeoffTime && !takeoffAt) return { error: "That takeoff time is not valid." };
  if (landingTime && !landingAt) return { error: "That landing time is not valid." };
  if (takeoffAt && landingAt && landingAt <= takeoffAt) {
    return { error: "Landing has to be after takeoff. For a flight over midnight, log two legs." };
  }

  // Duration is only required when the times are not given: with both, the
  // database derives it and the typed figure is ignored entirely.
  const durationMinutes = durationRaw === "" ? null : Number(durationRaw);
  if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes < 0)) {
    return { error: "Duration must be zero or more minutes." };
  }
  if (durationMinutes === null && !(takeoffAt && landingAt)) {
    return { error: "Give either a duration, or both takeoff and landing times." };
  }

  const numberOrNull = (raw: string, label: string, min: number, max: number) => {
    if (raw === "") return { value: null as number | null, error: null as string | null };
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) {
      return { value: null, error: `${label} must be between ${min} and ${max}.` };
    }
    return { value: n, error: null };
  };

  const lat = numberOrNull(latRaw, "Latitude", -90, 90);
  if (lat.error) return { error: lat.error };
  const lng = numberOrNull(lngRaw, "Longitude", -180, 180);
  if (lng.error) return { error: lng.error };
  const alt = numberOrNull(altRaw, "Maximum altitude", 0, 10000);
  if (alt.error) return { error: alt.error };

  // Half a coordinate is not a location, and storing one would put a marker in
  // the middle of the Atlantic on any future map.
  if ((lat.value === null) !== (lng.value === null)) {
    return { error: "Give both latitude and longitude, or neither." };
  }

  const airspace =
    airspaceRaw === "" ? null : parseEnum(airspaceRaw, AIRSPACE_CLASSES, "uncontrolled");
  if (airspaceRaw !== "" && airspace !== airspaceRaw) {
    return { error: "That is not an airspace class this portal recognises." };
  }

  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("flight_logs")
    .insert({
      pilot_id: pilotId,
      uav_id: uavId,
      flight_date: flightDate,
      duration_minutes: durationMinutes,
      weather_conditions: weatherConditions || null,
      mission_outcome: missionOutcome,
      takeoff_at: takeoffAt,
      landing_at: landingAt,
      location_name: locationName || null,
      latitude: lat.value,
      longitude: lng.value,
      max_altitude_m: alt.value,
      airspace,
      is_night: isNight,
      is_bvlos: isBvlos,
      is_over_people: isOverPeople,
      is_sheltered: isSheltered,
      sfoc_reference: sfocReference || null,
      project_id: projectId || null,
      // Filled by the weather lookup. Recorded as issued rather than
      // re-derived, so the log carries the observation itself.
      weather_station: weatherStation || null,
      weather_raw: weatherRaw || null,
      weather_observed_at: weatherObservedAt || null,
      wind_direction_deg: numberField(formData, "wind_direction_deg"),
      wind_speed_kt: numberField(formData, "wind_speed_kt"),
      temperature_c: numberField(formData, "temperature_c"),
      visibility_sm: numberField(formData, "visibility_sm"),
      flight_category: ["VFR", "MVFR", "IFR", "LIFR"].includes(flightCategoryRaw)
        ? flightCategoryRaw
        : null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: safeErrorMessage(error ?? { message: "insert failed" }, "flight log") };
  }

  // Packs and crew are separate rows. A failure here would leave a log that
  // understates its own cycles, so the log is removed rather than left partly
  // recorded — an incomplete maintenance record is worse than none.
  if (batteryIds.length > 0) {
    const { error: batteryError } = await supabase
      .from("flight_battery_usage")
      .insert(batteryIds.map((id) => ({ flight_log_id: inserted.id, battery_id: id })));
    if (batteryError) {
      await supabase.from("flight_logs").delete().eq("id", inserted.id);
      return { error: safeErrorMessage(batteryError, "flight log") };
    }
  }

  if (observerIds.length > 0) {
    const { error: crewError } = await supabase.from("flight_crew").insert(
      observerIds.map((id) => ({
        flight_log_id: inserted.id,
        pilot_id: id,
        role: "visual_observer" as const,
      })),
    );
    if (crewError) {
      await supabase.from("flight_logs").delete().eq("id", inserted.id);
      return { error: safeErrorMessage(crewError, "flight log") };
    }
  }

  revalidatePath("/flights");
  revalidatePath("/fleet");
  revalidatePath("/projects");
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
