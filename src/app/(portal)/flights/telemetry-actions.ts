"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { parseTelemetryCsv, downsample } from "@/lib/telemetry";

const BUCKET = "flight-telemetry";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
/** Points kept for the plot. Enough shape, small enough to send with a page. */
const TRACK_POINTS = 400;

/** Names the export's origin from its columns, for the record. */
function identifySource(headers: string[]): string {
  const joined = headers.join(" ");
  if (joined.includes("osd") || joined.includes("timemillisecond")) return "DJI";
  if (joined.includes("numsats") || joined.includes("groundspeed")) return "ArduPilot / PX4";
  return "Generic CSV";
}

/**
 * Imports a telemetry CSV against a flight log.
 *
 * The file is parsed before anything is stored, so a file the portal cannot
 * read is refused rather than uploaded and left orphaned — and the summary is
 * written from the parse rather than trusted from the client, which could
 * otherwise claim any altitude it liked.
 */
export async function importTelemetry(flightLogId: string, formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("logs")) {
    return { error: "You do not have permission to import telemetry." };
  }
  if (!flightLogId) return { error: "No flight selected." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Choose a telemetry file to import." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "That file is larger than the 20 MB limit. Export at a lower sample rate." };
  }

  const text = await file.text();
  const parsed = parseTelemetryCsv(text);
  if (parsed.error !== null) {
    return { error: parsed.error, unmatched: parsed.unmatchedHeaders };
  }

  const { samples, summary } = parsed;
  const supabase = await createClient();

  const { data: flight } = await supabase
    .from("flight_logs")
    .select("id, telemetry_path, max_altitude_m, duration_minutes")
    .eq("id", flightLogId)
    .maybeSingle();

  if (!flight) return { error: "That flight no longer exists. Refresh and try again." };

  const storagePath = `${flightLogId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
  if (uploadError) return { error: safeErrorMessage(uploadError, "upload") };

  // Only the positioned samples are worth plotting, and only at plot
  // resolution — the full-rate file remains in storage for anyone who needs it.
  const track = downsample(
    samples.filter((s) => s.lat !== null && s.lon !== null),
    TRACK_POINTS,
  ).map((s) => ({
    t: Math.round(s.t),
    lat: s.lat,
    lon: s.lon,
    alt: s.altitude === null ? null : Math.round(s.altitude * 10) / 10,
  }));

  const round = (n: number | null, dp = 1) =>
    n === null ? null : Math.round(n * 10 ** dp) / 10 ** dp;

  const { error: updateError } = await supabase
    .from("flight_logs")
    .update({
      telemetry_path: storagePath,
      telemetry_source: identifySource(
        text.split(/\r?\n/, 1)[0].split(",").map((h) => h.toLowerCase()),
      ),
      telemetry_imported_at: new Date().toISOString(),
      telemetry_sample_count: summary.sampleCount,
      telemetry_max_speed_ms: round(summary.maxSpeed, 2),
      telemetry_max_distance_m: round(summary.maxDistance),
      telemetry_track_length_m: round(summary.trackLength),
      battery_start_percent:
        summary.batteryStart === null ? null : Math.round(summary.batteryStart),
      battery_end_percent: summary.batteryEnd === null ? null : Math.round(summary.batteryEnd),
      min_voltage: round(summary.minVoltage, 2),
      min_satellites: summary.minSatellites === null ? null : Math.round(summary.minSatellites),
      telemetry_track: track.length > 1 ? track : null,
      // Only filled where nobody has recorded it: a measured altitude is
      // better than a typed one, but overwriting a figure a pilot entered
      // deliberately would be taking a decision that is not the import's.
      ...(flight.max_altitude_m === null && summary.maxAltitude !== null
        ? { max_altitude_m: round(summary.maxAltitude) }
        : {}),
    })
    .eq("id", flightLogId);

  if (updateError) {
    // Otherwise the object lingers with nothing pointing at it.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: safeErrorMessage(updateError, "import") };
  }

  // Replacing an earlier import: remove the file it left behind.
  if (flight.telemetry_path && flight.telemetry_path !== storagePath) {
    await supabase.storage.from(BUCKET).remove([flight.telemetry_path]);
  }

  revalidatePath("/flights");
  revalidatePath("/fleet");
  return {
    error: null,
    summary,
    unmatched: parsed.unmatchedHeaders,
    trackPoints: track.length,
  };
}

/** Removes an import, leaving the flight log itself untouched. */
export async function clearTelemetry(flightLogId: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("logs")) {
    return { error: "You do not have permission to change telemetry." };
  }

  const supabase = await createClient();
  const { data: flight } = await supabase
    .from("flight_logs")
    .select("telemetry_path")
    .eq("id", flightLogId)
    .maybeSingle();

  const { error } = await supabase
    .from("flight_logs")
    .update({
      telemetry_path: null,
      telemetry_source: null,
      telemetry_imported_at: null,
      telemetry_sample_count: null,
      telemetry_max_speed_ms: null,
      telemetry_max_distance_m: null,
      telemetry_track_length_m: null,
      battery_start_percent: null,
      battery_end_percent: null,
      min_voltage: null,
      min_satellites: null,
      telemetry_track: null,
    })
    .eq("id", flightLogId);

  if (error) return { error: safeErrorMessage(error, "update") };

  if (flight?.telemetry_path) {
    await supabase.storage.from(BUCKET).remove([flight.telemetry_path]);
  }

  revalidatePath("/flights");
  return { error: null };
}
