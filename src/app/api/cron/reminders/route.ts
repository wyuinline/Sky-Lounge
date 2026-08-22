import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanAll, type ReminderCandidate } from "@/lib/reminders";
import { isEmailConfigured, sendReminderDigest } from "@/lib/email";

/**
 * Weekly compliance reminder job — Wednesdays, 07:00 UTC.
 *
 * Scans for expiring credentials, due and overdue maintenance, upcoming audits
 * and overdue corrective actions, records a notification for each, then emails
 * a digest to the people responsible.
 *
 * Scheduled from vercel.json. Vercel sets CRON_SECRET as a bearer token on the
 * request; without that check the route would be an open endpoint anyone could
 * hammer to send mail.
 *
 * The run is idempotent, so the cadence is a scheduling choice rather than a
 * correctness one: running more often would surface newly-overdue items sooner
 * without producing duplicate reminders.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed. An unset secret must not mean "allow everyone".
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error("[reminders] admin client unavailable", error);
    return NextResponse.json({ error: "Reminders are not configured." }, { status: 500 });
  }

  const now = new Date();

  const [pilotsRes, certsRes, maintenanceRes, airframeHoursRes, auditsRes, findingsRes] = await Promise.all([
    supabase.from("pilots").select("id, full_name, medical_expiry, profile_id"),
    supabase
      .from("training_records")
      .select("id, certification_name, expiry_date, pilot_id, pilots(full_name, profile_id)"),
    supabase
      .from("maintenance_records")
      .select("id, status, next_service_date, maintenance_type, uavs(drone_id)"),
    // Hours-since-service is derived by this view; the raw tables don't carry it.
    supabase
      .from("uav_maintenance_status")
      .select("uav_id, drone_id, maintenance_interval_hours, hours_since_service, hours_until_service"),
    supabase.from("audits").select("id, status, audit_date, audit_type"),
    supabase.from("audit_findings").select("id, status, due_date, description, severity, assigned_to"),
  ]);

  const firstError =
    pilotsRes.error ??
    certsRes.error ??
    maintenanceRes.error ??
    airframeHoursRes.error ??
    auditsRes.error ??
    findingsRes.error;
  if (firstError) {
    console.error("[reminders] scan query failed", firstError);
    return NextResponse.json({ error: "Could not read operational data." }, { status: 500 });
  }

  const candidates = scanAll(
    {
      pilots: pilotsRes.data ?? [],
      certifications: (certsRes.data ?? []).map((c) => ({
        id: c.id,
        certification_name: c.certification_name,
        expiry_date: c.expiry_date,
        pilot_id: c.pilot_id,
        pilot_name: c.pilots?.full_name ?? null,
        pilot_profile_id: c.pilots?.profile_id ?? null,
      })),
      maintenance: (maintenanceRes.data ?? []).map((m) => ({
        id: m.id,
        status: m.status,
        next_service_date: m.next_service_date,
        maintenance_type: m.maintenance_type,
        drone_id: m.uavs?.drone_id ?? null,
      })),
      airframeHours: (airframeHoursRes.data ?? []).map((a) => ({
        uav_id: a.uav_id ?? "",
        drone_id: a.drone_id ?? "",
        maintenance_interval_hours: a.maintenance_interval_hours,
        hours_since_service: a.hours_since_service,
        hours_until_service: a.hours_until_service,
      })),
      audits: auditsRes.data ?? [],
      findings: findingsRes.data ?? [],
    },
    now,
  );

  if (candidates.length === 0) {
    return NextResponse.json({ scanned: true, created: 0, emailed: 0, message: "Nothing due." });
  }

  // Upsert on dedupe_key so a daily run over unchanged data is a no-op rather
  // than piling up duplicates. ignoreDuplicates keeps the original created_at.
  const { data: written, error: writeError } = await supabase
    .from("notifications")
    .upsert(candidates, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id, dedupe_key");

  if (writeError) {
    console.error("[reminders] could not record notifications", writeError);
    return NextResponse.json({ error: "Could not record reminders." }, { status: 500 });
  }

  // Only email reminders that are new in this run; anything already recorded
  // was mailed on the day it first appeared.
  const newKeys = new Set((written ?? []).map((row) => row.dedupe_key));
  const fresh = candidates.filter((c) => newKeys.has(c.dedupe_key));

  let emailed = 0;
  if (fresh.length > 0 && isEmailConfigured()) {
    emailed = await emailDigests(supabase, fresh);
  }

  return NextResponse.json({
    scanned: true,
    candidates: candidates.length,
    created: fresh.length,
    emailed,
    emailConfigured: isEmailConfigured(),
  });
}

/** Groups reminders by recipient and sends one digest each. */
async function emailDigests(
  supabase: ReturnType<typeof createAdminClient>,
  reminders: ReminderCandidate[],
): Promise<number> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("active", true);

  if (error || !profiles) {
    console.error("[reminders] could not load recipients", error);
    return 0;
  }

  const byRecipient = new Map<string, ReminderCandidate[]>();

  for (const profile of profiles) {
    if (!profile.email) continue;
    const relevant = reminders.filter(
      (r) =>
        r.target_profile_id === profile.id ||
        r.target_roles.includes(profile.role as ReminderCandidate["target_roles"][number]),
    );
    if (relevant.length > 0) byRecipient.set(profile.email, relevant);
  }

  const results = await Promise.all(
    [...byRecipient.entries()].map(async ([email, items]) => {
      const result = await sendReminderDigest(email, items);
      return result.ok;
    }),
  );

  const sent = results.filter(Boolean).length;

  if (sent > 0) {
    await supabase
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .in(
        "dedupe_key",
        reminders.map((r) => r.dedupe_key),
      );
  }

  return sent;
}
