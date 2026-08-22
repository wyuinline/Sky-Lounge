import {
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
  | "medical_expiring"
  | "medical_expired"
  | "maintenance_due"
  | "maintenance_overdue"
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

function severityForDays(days: number): Severity {
  if (days < 0) return "critical";
  if (days <= 7) return "high";
  if (days <= 30) return "medium";
  return "low";
}

export type PilotRecord = {
  id: string;
  full_name: string;
  medical_expiry: string | null;
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

export function scanMedicals(pilots: PilotRecord[], now = new Date()): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];

  for (const pilot of pilots) {
    const days = daysUntil(pilot.medical_expiry, now);
    if (days === null) continue;

    if (days < 0) {
      out.push({
        dedupe_key: `medical_expired:${pilot.id}:${pilot.medical_expiry}:0`,
        kind: "medical_expired",
        severity: "critical",
        title: `${pilot.full_name}'s medical certificate has expired`,
        body: `It expired on ${pilot.medical_expiry}. The pilot is not cleared to fly until it is renewed.`,
        entity_table: "pilots",
        entity_id: pilot.id,
        due_date: pilot.medical_expiry,
        target_roles: COMPLIANCE_ROLES,
        target_profile_id: pilot.profile_id,
      });
      continue;
    }

    const threshold = crossedThreshold(days);
    if (threshold === null) continue;

    out.push({
      dedupe_key: `medical_expiring:${pilot.id}:${pilot.medical_expiry}:${threshold}`,
      kind: "medical_expiring",
      severity: severityForDays(days),
      title: `${pilot.full_name}'s medical certificate expires in ${days} day${days === 1 ? "" : "s"}`,
      body: `It expires on ${pilot.medical_expiry}. Book the renewal to keep the pilot current.`,
      entity_table: "pilots",
      entity_id: pilot.id,
      due_date: pilot.medical_expiry,
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
    audits: AuditRecord[];
    findings: FindingRecord[];
  },
  now = new Date(),
): ReminderCandidate[] {
  return [
    ...scanMedicals(data.pilots, now),
    ...scanCertifications(data.certifications, now),
    ...scanMaintenance(data.maintenance, now),
    ...scanAudits(data.audits, now),
    ...scanFindings(data.findings, now),
  ];
}
