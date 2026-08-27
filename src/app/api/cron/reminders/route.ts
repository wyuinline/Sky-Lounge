import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanAll, type ReminderCandidate } from "@/lib/reminders";
import { isEmailConfigured, sendReminderDigest } from "@/lib/email";
import { notify } from "@/lib/webhook-dispatch";
import type { WebhookEvent } from "@/lib/webhooks";

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

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error("[reminders] admin client unavailable", error);
    return NextResponse.json({ error: "Reminders are not configured." }, { status: 500 });
  }

  const now = new Date();

  const { data: organisations, error: orgError } = await supabase
    .from("organisations")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (orgError) {
    console.error("[reminders] could not list organisations", orgError);
    return NextResponse.json({ error: "Could not list organisations." }, { status: 500 });
  }

  // One operator at a time. This job runs on the service role, so nothing else
  // is scoping these queries — and a digest that mixed two operators' fleets
  // would be the worst possible way to find that out.
  const results = [];
  for (const organisation of organisations ?? []) {
    results.push(await scanOrganisation(supabase, organisation, now));
  }

  // Delivery logs are only useful while recent, and this is the one job that
  // already runs on a schedule. Not per organisation: the table is pruned by
  // age, not by owner.
  const { data: pruned } = await supabase.rpc("prune_webhook_deliveries", { p_keep_days: 30 });

  return NextResponse.json({
    scanned: true,
    organisations: results.length,
    emailConfigured: isEmailConfigured(),
    deliveryLogsPruned: pruned ?? 0,
    results,
  });
}

async function scanOrganisation(
  supabase: ReturnType<typeof createAdminClient>,
  organisation: { id: string; name: string },
  now: Date,
) {
  const organisationId = organisation.id;

  const [
    pilotsRes,
    certsRes,
    documentsRes,
    maintenanceRes,
    airframeHoursRes,
    auditsRes,
    findingsRes,
  ] = await Promise.all([
    // Departed crew and retired airframes are excluded throughout: chasing a
    // lapsed certificate for someone who left, or a service interval on an
    // airframe that will never fly again, is noise that trains people to
    // ignore the whole digest.
    supabase
      .from("pilots")
      .select("id, full_name, certificate_expires, last_recency_activity, profile_id")
      .eq("organisation_id", organisationId)
      .eq("active", true),
    supabase
      .from("training_records")
      .select("id, certification_name, expiry_date, pilot_id, pilots(full_name, profile_id, active)")
      .eq("organisation_id", organisationId),
    // The view derives review_due, so the documents page and this scan cannot
    // disagree about when something is due.
    supabase
      .from("document_review_status")
      .select(
        "id, title, category, review_interval_months, last_reviewed_at, effective_date, created_at, expires_at, pilot_name, pilot_profile_id, pilot_active",
      )
      .eq("organisation_id", organisationId),
    supabase
      .from("maintenance_records")
      .select("id, status, next_service_date, maintenance_type, uavs(drone_id)")
      .eq("organisation_id", organisationId),
    // Hours-since-service is derived by this view; the raw tables don't carry it.
    supabase
      .from("uav_fleet_status")
      .select("uav_id, drone_id, maintenance_interval_hours, hours_since_service, hours_until_service")
      .eq("organisation_id", organisationId)
      .neq("status", "retired"),
    supabase
      .from("audits")
      .select("id, status, audit_date, audit_type")
      .eq("organisation_id", organisationId),
    supabase
      .from("audit_findings")
      .select("id, status, due_date, description, severity, assigned_to")
      .eq("organisation_id", organisationId),
  ]);

  const firstError =
    pilotsRes.error ??
    certsRes.error ??
    documentsRes.error ??
    maintenanceRes.error ??
    airframeHoursRes.error ??
    auditsRes.error ??
    findingsRes.error;
  if (firstError) {
    console.error(`[reminders] scan failed for ${organisation.name}`, firstError);
    // One operator's outage must not stop the others being reminded.
    return { organisation: organisation.name, error: "Could not read operational data." };
  }

  const candidates = scanAll(
    {
      pilots: pilotsRes.data ?? [],
      certifications: (certsRes.data ?? [])
        // An orphaned record (no pilot linked) still matters; one belonging to
        // someone who has left does not.
        .filter((c) => c.pilots === null || c.pilots.active)
        .map((c) => ({
        id: c.id,
        certification_name: c.certification_name,
        expiry_date: c.expiry_date,
        pilot_id: c.pilot_id,
        pilot_name: c.pilots?.full_name ?? null,
        pilot_profile_id: c.pilots?.profile_id ?? null,
      })),
      documents: (documentsRes.data ?? [])
        // A document belonging to someone who has left is not a live
        // obligation; one belonging to nobody in particular still is.
        .filter((d) => d.pilot_profile_id === null || d.pilot_active)
        .map((d) => ({
          id: d.id ?? "",
          title: d.title ?? "Untitled document",
          category: d.category ?? "",
          review_interval_months: d.review_interval_months,
          last_reviewed_at: d.last_reviewed_at,
          effective_date: d.effective_date,
          created_at: d.created_at,
          expires_at: d.expires_at,
          pilot_name: d.pilot_name,
          pilot_profile_id: d.pilot_profile_id,
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
    return { organisation: organisation.name, candidates: 0, created: 0, emailed: 0 };
  }

  // Upsert on dedupe_key so a daily run over unchanged data is a no-op rather
  // than piling up duplicates. ignoreDuplicates keeps the original created_at.
  const { data: written, error: writeError } = await supabase
    .from("notifications")
    // organisation_id is set here rather than left to the column default: the
    // default reads the caller's organisation, and a scheduled job has no
    // caller to read.
    .upsert(
      candidates.map((c) => ({ ...c, organisation_id: organisationId })),
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    )
    .select("id, dedupe_key");

  if (writeError) {
    console.error(`[reminders] could not record reminders for ${organisation.name}`, writeError);
    return { organisation: organisation.name, error: "Could not record reminders." };
  }

  const newKeys = new Set((written ?? []).map((row) => row.dedupe_key));

  // Only what is new this run is pushed. A weekly rescan over unchanged data
  // must not re-announce the same expiry to a Teams channel every Wednesday.
  pushNewReminders(candidates.filter((c) => newKeys.has(c.dedupe_key)), organisationId);

  // Email everything not yet successfully sent, not merely what was created in
  // this run. Keying off "new this run" meant a failed send was never retried:
  // the next run finds the row already present, so it would never be mailed.
  const { data: unsent, error: unsentError } = await supabase
    .from("notifications")
    .select("dedupe_key")
    .eq("organisation_id", organisationId)
    .is("emailed_at", null);

  if (unsentError) {
    console.error("[reminders] could not determine unsent reminders", unsentError);
  }

  const unsentKeys = new Set((unsent ?? []).map((row) => row.dedupe_key));
  const toEmail = candidates.filter((c) => unsentKeys.has(c.dedupe_key));

  let emailed = 0;
  if (toEmail.length > 0 && isEmailConfigured()) {
    emailed = await emailDigests(supabase, organisationId, toEmail);
  }

  return {
    organisation: organisation.name,
    candidates: candidates.length,
    created: newKeys.size,
    pendingEmail: toEmail.length,
    emailed,
  };
}

/**
 * The reminder kinds that are worth pushing to an external system.
 *
 * Deliberately partial. An audit finding falling overdue is an internal matter
 * for the compliance lead; a certificate about to lapse is something a
 * scheduling system on the other end genuinely needs to know.
 */
const REMINDER_EVENTS: Partial<Record<ReminderCandidate["kind"], WebhookEvent>> = {
  certification_expiring: "certification.expiring",
  certification_expired: "certification.expiring",
  pilot_certificate_expiring: "certification.expiring",
  pilot_certificate_expired: "certification.expiring",
  recency_due: "certification.expiring",
  recency_overdue: "certification.expiring",
  document_review_due: "document.expiring",
  document_review_overdue: "document.expiring",
  document_expiring: "document.expiring",
  document_expired: "document.expiring",
  maintenance_due: "maintenance.due",
  maintenance_overdue: "maintenance.due",
  maintenance_hours_due: "maintenance.due",
  maintenance_hours_overdue: "maintenance.due",
};

/**
 * Pushes new reminders, one delivery per event type rather than per item.
 *
 * A scan that turns up thirty expiring certificates should be one message a
 * person reads, not thirty a person mutes.
 */
function pushNewReminders(created: ReminderCandidate[], organisationId: string): void {
  const byEvent = new Map<WebhookEvent, ReminderCandidate[]>();

  for (const candidate of created) {
    const event = REMINDER_EVENTS[candidate.kind];
    if (!event) continue;
    byEvent.set(event, [...(byEvent.get(event) ?? []), candidate]);
  }

  for (const [event, items] of byEvent) {
    notify(
      event,
      {
        count: items.length,
        items: items.map((i) => ({
          kind: i.kind,
          severity: i.severity,
          title: i.title,
          due_date: i.due_date,
          entity_table: i.entity_table,
          entity_id: i.entity_id,
        })),
      },
      organisationId,
    );
  }
}

/** Groups reminders by recipient and sends one digest each. */
async function emailDigests(
  supabase: ReturnType<typeof createAdminClient>,
  organisationId: string,
  reminders: ReminderCandidate[],
): Promise<number> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("organisation_id", organisationId)
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
  const allSucceeded = results.length > 0 && sent === results.length;

  // Only mark as emailed when every recipient succeeded. On a partial failure
  // the reminders stay unsent so the next run retries them: someone may then
  // receive a duplicate, which is a far better outcome than a lapsed
  // certificate that nobody is ever told about.
  if (allSucceeded) {
    await supabase
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .in(
        "dedupe_key",
        reminders.map((r) => r.dedupe_key),
      );
  } else if (sent > 0) {
    console.warn(
      `[reminders] ${sent}/${results.length} digests sent; leaving reminders unsent for retry`,
    );
  }

  return sent;
}
