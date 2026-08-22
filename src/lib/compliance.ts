/**
 * Compliance status derivation.
 *
 * The schema stores status columns like maintenance_records.status and
 * training_records.status, but nothing ever advanced them to 'overdue' or
 * 'expired' — they kept their insert-time defaults forever, so every overdue
 * and expired figure in the portal read zero regardless of the real dates.
 *
 * Time-based state is derived here from the date columns instead. Stored
 * status is still meaningful for genuine workflow transitions a human makes
 * (scheduled -> completed, open -> closed); it is the passage of time that
 * cannot be represented by a column nobody updates.
 *
 * Dates are compared as ISO `YYYY-MM-DD` strings. Lexicographic comparison is
 * correct for that format and avoids the timezone drift you get from parsing
 * a date-only value into a Date and comparing instants.
 */

export type ExpiryStatus = "current" | "due_soon" | "expired";

/** Default window before an expiry date starts reporting as "due soon". */
export const DUE_SOON_DAYS = 60;

/** Today as `YYYY-MM-DD` in local time. */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` for a number of days from `now`. Negative counts go backwards. */
export function isoDaysFromNow(days: number, now: Date = new Date()): string {
  const shifted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return todayIso(shifted);
}

/**
 * Whole days from today until `date`. Negative means the date has passed.
 * Returns null when there is no date to measure against.
 */
export function daysUntil(date: string | null, now: Date = new Date()): number | null {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Expiry state for a dated credential — a medical certificate, a licence, a
 * training record. A missing expiry date is treated as "current": the record
 * simply doesn't expire, which is different from being overdue.
 */
export function deriveExpiryStatus(
  expiryDate: string | null,
  now: Date = new Date(),
  dueSoonDays: number = DUE_SOON_DAYS,
): ExpiryStatus {
  const days = daysUntil(expiryDate, now);
  if (days === null) return "current";
  if (days < 0) return "expired";
  if (days <= dueSoonDays) return "due_soon";
  return "current";
}

/**
 * Maintenance is overdue when it is still outstanding and its service date has
 * passed. Completed work is never overdue, however late it ran.
 */
export function isMaintenanceOverdue(
  record: { status: string; next_service_date: string | null },
  now: Date = new Date(),
): boolean {
  if (record.status === "completed") return false;
  const days = daysUntil(record.next_service_date, now);
  return days !== null && days < 0;
}

/** An audit finding is overdue when it is still open past its due date. */
export function isFindingOverdue(
  finding: { status: string; due_date: string | null },
  now: Date = new Date(),
): boolean {
  if (finding.status === "closed") return false;
  const days = daysUntil(finding.due_date, now);
  return days !== null && days < 0;
}

/** A planned audit is overdue once its scheduled date has passed. */
export function isAuditOverdue(
  audit: { status: string; audit_date: string | null },
  now: Date = new Date(),
): boolean {
  if (audit.status === "completed") return false;
  const days = daysUntil(audit.audit_date, now);
  return days !== null && days < 0;
}

/**
 * A pilot's flight currency is only as good as their weakest credential, so
 * this reports the worst state across the medical certificate and every
 * training record.
 */
export function derivePilotCurrency(
  medicalExpiry: string | null,
  certificationExpiries: (string | null)[] = [],
  now: Date = new Date(),
): ExpiryStatus {
  const statuses = [
    deriveExpiryStatus(medicalExpiry, now),
    ...certificationExpiries.map((d) => deriveExpiryStatus(d, now)),
  ];
  if (statuses.includes("expired")) return "expired";
  if (statuses.includes("due_soon")) return "due_soon";
  return "current";
}

/**
 * Transport Canada requires an RPAS pilot to complete a recency activity every
 * 24 months. The due date follows from the last activity, so it is derived
 * rather than stored.
 */
export const RECENCY_MONTHS = 24;

/** Recency due date, or null when no activity has been recorded. */
export function recencyDue(
  lastActivity: string | null,
  months: number = RECENCY_MONTHS,
): string | null {
  if (!lastActivity) return null;
  const start = new Date(`${lastActivity.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  // Date.setMonth overflows rather than clamping: 31 Aug + 6 months becomes
  // "Feb 31" and rolls forward into March, pushing a compliance deadline later
  // than it should be. Clamp to the last valid day of the target month instead.
  const targetMonthStart = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0,
  ).getDate();
  targetMonthStart.setDate(Math.min(start.getDate(), lastDayOfTargetMonth));
  return todayIso(targetMonthStart);
}

/**
 * Overall credential state for a pilot: the worst of certificate expiry and
 * recency. Returns null when neither is on file, which the UI shows as
 * "no expiry on file" rather than implying the pilot is compliant.
 */
export function derivePilotCertificateStatus(
  certificateExpires: string | null,
  lastRecencyActivity: string | null,
  now: Date = new Date(),
): ExpiryStatus | null {
  const due = recencyDue(lastRecencyActivity);
  if (!certificateExpires && !due) return null;

  const statuses: ExpiryStatus[] = [];
  if (certificateExpires) statuses.push(deriveExpiryStatus(certificateExpires, now));
  if (due) statuses.push(deriveExpiryStatus(due, now));

  if (statuses.includes("expired")) return "expired";
  if (statuses.includes("due_soon")) return "due_soon";
  return "current";
}

export const certificateTypeLabel: Record<string, string> = {
  basic_operations: "Basic Operations",
  advanced_operations: "Advanced Operations",
  level_1_complex: "Level 1 Complex",
};

export const expiryStatusLabel: Record<ExpiryStatus, string> = {
  current: "Current",
  due_soon: "Due Soon",
  expired: "Expired",
};

export const expiryStatusTone: Record<ExpiryStatus, "good" | "warning" | "critical"> = {
  current: "good",
  due_soon: "warning",
  expired: "critical",
};
