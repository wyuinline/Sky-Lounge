import {
  recencyDue,
  daysUntil,
  isAuditOverdue,
  isFindingOverdue,
  isMaintenanceOverdue,
} from "@/lib/compliance";

/**
 * Reminder scanning.
 *
 * These are pure functions: given the current records and a reference date,
 * they return the reminders that *should* exist. Nothing here touches the
 * database or sends anything, which keeps the rules unit-testable and keeps
 * the scheduled job free of business logic.
 */

export type NotificationKind =
  | "certification_expiring"
  | "certification_expired"
  | "pilot_certificate_expiring"
  | "pilot_certificate_expired"
  | "recency_due"
  | "recency_overdue"
  | "maintenance_due"
  | "maintenance_overdue"
  | "maintenance_hours_due"
  | "maintenance_hours_overdue"
  | "audit_upcoming"
  | "audit_overdue"
  | "finding_overdue";

export type Severity = "low" | "medium" | "high" | "critical";
export type UserRole =
  | "uav_admin"
  | "ops_manager"
  | "pilot"
  | "auditor"
  | "maintenance_team"
  | "read_only";

export type ReminderCandidate = {
  dedupe_key: string;
  kind: NotificationKind;
  severity: Severity;
  title: string;
  body: string;
  entity_table: string;
  entity_id: string;
  due_date: string | null;
  target_roles: UserRole[];
  target_profile_id: string | null;
};

/**
 * Warning thresholds in days. A credential crosses 60 then 30 then 7, and each
 * crossing is a distinct reminder, so an approaching expiry escalates rather
 * than being mentioned once and forgotten.
 */
export const EXPIRY_THRESHOLDS = [60, 30, 7] as const;

/** The tightest threshold a given number of days has crossed, if any. */
export function crossedThreshold(days: number): number | null {
  for (const t of [...EXPIRY_THRESHOLDS].sort((a, b) => a - b)) {
    if (days <= t) return t;
  }
  return null;
}

/**
 * Flight-hour thresholds for maintenance intervals, mirroring the day-based
 * escalation. Deliberately generous at the top end: the scan runs weekly, and
 * an airframe can put on a lot of hours between runs, so warning only at the
 * last few hours would routinely be skipped past.
 */
export const HOURS_THRESHOLDS = [25, 10, 5] as const;

/** The tightest hours threshold a remaining-hours figure has crossed. */
export function crossedHoursThreshold(hoursRemaining: number): number | null {
  for (const t of [...HOURS_THRESHOLDS].sort((a, b) => a - b)) {
    if (hoursRemaining <= t) return t;
  }
  return null;
}

function severityForHours(hoursRemaining: number): Severity {
  if (hoursRemaining <= 0) return "critical";
  if (hoursRemaining <= 5) return "high";
  if (hoursRemaining <= 10) return "medium";
  return "low";
}

/** Rounds to one decimal so reminder text doesn't read "12.700000000000001 hours". */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function severityForDays(days: number): Severity {
  if (days < 0) return "critical";
  if (days <= 7) return "high";
  if (days <= 30) return "medium";
  return "low";
}

export type PilotRecord = {
  id: string;
  full_name: string;
  certificate_expires: string | null;
  last_recency_activity: string | null;
  profile_id: string | null;
};

export type CertificationRecord = {
  id: string;
  certification_name: string;
  expiry_date: string | null;
  pilot_id: string | null;
  pilot_name: string | null;
  pilot_profile_id: string | null;
};

export type MaintenanceRecord = {
  id: string;
  status: string;
  next_service_date: string | null;
  maintenance_type: string;
  drone_id: string | null;
};

/** A row of the uav_maintenance_status view. */
export type AirframeHoursRecord = {
  uav_id: string;
  drone_id: string;
  maintenance_interval_hours: number | null;
  hours_since_service: number | null;
  hours_until_service: number | null;
};

export type AuditRecord = {
  id: string;
  status: string;
  audit_date: string | null;
  audit_type: string;
};

export type FindingRecord = {
  id: string;
  status: string;
  due_date: string | null;
  description: string;
  severity: Severity;
  assigned_to: string | null;
};

const COMPLIANCE_ROLES: UserRole[] = ["uav_admin", "ops_manager"];
const MAINTENANCE_ROLES: UserRole[] = ["uav_admin", "maintenance_team"];
const AUDIT_ROLES: UserRole[] = ["uav_admin", "ops_manager", "auditor"];

/**
 * RPAS pilot credentials: the Transport Canada pilot certificate and the
 * 24-month recency activity. Both must be current for a pilot to fly, so each
 * is reported separately — a valid certificate does not excuse lapsed recency.
 */
export function scanPilotCredentials(
  pilots: PilotRecord[],
  now = new Date(),
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];

  for (const pilot of pilots) {
    // --- Pilot certificate ---
    const certDays = daysUntil(pilot.certificate_expires, now);
    if (certDays !== null) {
      if (certDays < 0) {
        out.push({
          dedupe_key: `pilot_certificate_expired:${pilot.id}:${pilot.certificate_expires}:0`,
          kind: "pilot_certificate_expired",
          severity: "critical",
          title: `${pilot.full_name}'s RPAS certificate has expired`,
          body: `It expired on ${pilot.certificate_expires}. The pilot is not permitted to fly until it is renewed.`,
          entity_table: "pilots",
          entity_id: pilot.id,
          due_date: pilot.certificate_expires,
          target_roles: COMPLIANCE_ROLES,
          target_profile_id: pilot.profile_id,
        });
      } else {
        const threshold = crossedThreshold(certDays);
        if (threshold !== null) {
          out.push({
            dedupe_key: `pilot_certificate_expiring:${pilot.id}:${pilot.certificate_expires}:${threshold}`,
            kind: "pilot_certificate_expiring",
            severity: severityForDays(certDays),
            title: `${pilot.full_name}'s RPAS certificate expires in ${certDays} day${certDays === 1 ? "" : "s"}`,
            body: `It expires on ${pilot.certificate_expires}. Start the renewal.`,
            entity_table: "pilots",
            entity_id: pilot.id,
            due_date: pilot.certificate_expires,
            target_roles: COMPLIANCE_ROLES,
            target_profile_id: pilot.profile_id,
          });
        }
      }
    }

    // --- Recency activity ---
    const due = recencyDue(pilot.last_recency_activity);
    const recencyDays = daysUntil(due, now);
    if (recencyDays === null) continue;

    if (recencyDays < 0) {
      out.push({
        dedupe_key: `recency_overdue:${pilot.id}:${due}:0`,
        kind: "recency_overdue",
        severity: "critical",
        title: `${pilot.full_name} is out of recency`,
        body: `Recency was due on ${due}. A recency activity is required every 24 months before the pilot may fly again.`,
        entity_table: "pilots",
        entity_id: pilot.id,
        due_date: due,
        target_roles: COMPLIANCE_ROLES,
        target_profile_id: pilot.profile_id,
      });
      continue;
    }

    const threshold = crossedThreshold(recencyDays);
    if (threshold === null) continue;

    out.push({
      dedupe_key: `recency_due:${pilot.id}:${due}:${threshold}`,
      kind: "recency_due",
      severity: severityForDays(recencyDays),
      title: `${pilot.full_name}'s recency is due in ${recencyDays} day${recencyDays === 1 ? "" : "s"}`,
      body: `Recency falls due on ${due}. Book a recency activity to keep the pilot current.`,
      entity_table: "pilots",
      entity_id: pilot.id,
      due_date: due,
      target_roles: COMPLIANCE_ROLES,
      target_profile_id: pilot.profile_id,
    });
  }

  return out;
}

export function scanCertifications(
  certs: CertificationRecord[],
  now = new Date(),
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];

  for (const cert of certs) {
    const days = daysUntil(cert.expiry_date, now);
    if (days === null) continue;

    const who = cert.pilot_name ?? "An unassigned pilot";

    if (days < 0) {
      out.push({
        dedupe_key: `certification_expired:${cert.id}:${cert.expiry_date}:0`,
        kind: "certification_expired",
        severity: "critical",
        title: `${who}'s ${cert.certification_name} has expired`,
        body: `It expired on ${cert.expiry_date} and needs renewing before related operations continue.`,
        entity_table: "training_records",
        entity_id: cert.id,
        due_date: cert.expiry_date,
        target_roles: COMPLIANCE_ROLES,
        target_profile_id: cert.pilot_profile_id,
      });
      continue;
    }

    const threshold = crossedThreshold(days);
    if (threshold === null) continue;

    out.push({
      dedupe_key: `certification_expiring:${cert.id}:${cert.expiry_date}:${threshold}`,
      kind: "certification_expiring",
      severity: severityForDays(days),
      title: `${who}'s ${cert.certification_name} expires in ${days} day${days === 1 ? "" : "s"}`,
      body: `It expires on ${cert.expiry_date}. Schedule the renewal.`,
      entity_table: "training_records",
      entity_id: cert.id,
      due_date: cert.expiry_date,
      target_roles: COMPLIANCE_ROLES,
      target_profile_id: cert.pilot_profile_id,
    });
  }

  return out;
}

export function scanMaintenance(
  records: MaintenanceRecord[],
  now = new Date(),
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];

  for (const record of records) {
    if (record.status === "completed") continue;
    const days = daysUntil(record.next_service_date, now);
    if (days === null) continue;

    const uav = record.drone_id ?? "Unassigned UAV";

    if (isMaintenanceOverdue(record, now)) {
      out.push({
        dedupe_key: `maintenance_overdue:${record.id}:${record.next_service_date}:0`,
        kind: "maintenance_overdue",
        severity: "critical",
        title: `${uav} maintenance is overdue`,
        body: `${record.maintenance_type} was due on ${record.next_service_date}.`,
        entity_table: "maintenance_records",
        entity_id: record.id,
        due_date: record.next_service_date,
        target_roles: MAINTENANCE_ROLES,
        target_profile_id: null,
      });
      continue;
    }

    const threshold = crossedThreshold(days);
    if (threshold === null) continue;

    out.push({
      dedupe_key: `maintenance_due:${record.id}:${record.next_service_date}:${threshold}`,
      kind: "maintenance_due",
      severity: severityForDays(days),
      title: `${uav} ${record.maintenance_type} is due in ${days} day${days === 1 ? "" : "s"}`,
      body: `Scheduled for ${record.next_service_date}.`,
      entity_table: "maintenance_records",
      entity_id: record.id,
      due_date: record.next_service_date,
      target_roles: MAINTENANCE_ROLES,
      target_profile_id: null,
    });
  }

  return out;
}

/**
 * Maintenance driven by the flight-hour interval rather than a calendar date.
 *
 * Airframes with no interval set are skipped: no interval means no hours-based
 * schedule to be due against, which is different from being up to date.
 *
 * The dedupe key uses the threshold band rather than the exact hours figure,
 * so a scan the following week at slightly different hours does not raise a
 * duplicate reminder for the same band.
 */
export function scanMaintenanceHours(
  airframes: AirframeHoursRecord[],
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];

  for (const frame of airframes) {
    const interval = frame.maintenance_interval_hours;
    const remaining = frame.hours_until_service;
    if (interval === null || remaining === null) continue;

    const since = round1(frame.hours_since_service ?? 0);

    if (remaining <= 0) {
      out.push({
        dedupe_key: `maintenance_hours_overdue:${frame.uav_id}:${interval}:0`,
        kind: "maintenance_hours_overdue",
        severity: "critical",
        title: `${frame.drone_id} has passed its ${interval}-hour service interval`,
        body: `It has flown ${since} hours since the last completed service. Ground it until the service is done.`,
        entity_table: "uavs",
        entity_id: frame.uav_id,
        due_date: null,
        target_roles: MAINTENANCE_ROLES,
        target_profile_id: null,
      });
      continue;
    }

    const threshold = crossedHoursThreshold(remaining);
    if (threshold === null) continue;

    out.push({
      dedupe_key: `maintenance_hours_due:${frame.uav_id}:${interval}:${threshold}`,
      kind: "maintenance_hours_due",
      severity: severityForHours(remaining),
      title: `${frame.drone_id} is ${round1(remaining)} flight hours from its ${interval}-hour service`,
      body: `It has flown ${since} hours since the last completed service. Book the service before it reaches the interval.`,
      entity_table: "uavs",
      entity_id: frame.uav_id,
      due_date: null,
      target_roles: MAINTENANCE_ROLES,
      target_profile_id: null,
    });
  }

  return out;
}

export function scanAudits(audits: AuditRecord[], now = new Date()): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];

  for (const audit of audits) {
    if (audit.status === "completed") continue;
    const days = daysUntil(audit.audit_date, now);
    if (days === null) continue;

    const label = audit.audit_type === "internal" ? "Internal audit" : "Regulatory audit";

    if (isAuditOverdue(audit, now)) {
      out.push({
        dedupe_key: `audit_overdue:${audit.id}:${audit.audit_date}:0`,
        kind: "audit_overdue",
        severity: "critical",
        title: `${label} is overdue`,
        body: `It was scheduled for ${audit.audit_date} and has not been completed.`,
        entity_table: "audits",
        entity_id: audit.id,
        due_date: audit.audit_date,
        target_roles: AUDIT_ROLES,
        target_profile_id: null,
      });
      continue;
    }

    const threshold = crossedThreshold(days);
    if (threshold === null) continue;

    out.push({
      dedupe_key: `audit_upcoming:${audit.id}:${audit.audit_date}:${threshold}`,
      kind: "audit_upcoming",
      severity: severityForDays(days),
      title: `${label} in ${days} day${days === 1 ? "" : "s"}`,
      body: `Scheduled for ${audit.audit_date}. Prepare the evidence pack.`,
      entity_table: "audits",
      entity_id: audit.id,
      due_date: audit.audit_date,
      target_roles: AUDIT_ROLES,
      target_profile_id: null,
    });
  }

  return out;
}

export function scanFindings(findings: FindingRecord[], now = new Date()): ReminderCandidate[] {
  return findings.filter((f) => isFindingOverdue(f, now)).map((finding) => ({
    dedupe_key: `finding_overdue:${finding.id}:${finding.due_date}:0`,
    kind: "finding_overdue" as const,
    severity: "critical" as const,
    title: `Corrective action is overdue`,
    body: `"${finding.description}" was due on ${finding.due_date}.`,
    entity_table: "audit_findings",
    entity_id: finding.id,
    due_date: finding.due_date,
    target_roles: AUDIT_ROLES,
    // Also surface it to whoever owns the action.
    target_profile_id: finding.assigned_to,
  }));
}

export function scanAll(
  data: {
    pilots: PilotRecord[];
    certifications: CertificationRecord[];
    maintenance: MaintenanceRecord[];
    airframeHours?: AirframeHoursRecord[];
    audits: AuditRecord[];
    findings: FindingRecord[];
  },
  now = new Date(),
): ReminderCandidate[] {
  return [
    ...scanPilotCredentials(data.pilots, now),
    ...scanCertifications(data.certifications, now),
    ...scanMaintenance(data.maintenance, now),
    ...scanMaintenanceHours(data.airframeHours ?? []),
    ...scanAudits(data.audits, now),
    ...scanFindings(data.findings, now),
  ];
}
