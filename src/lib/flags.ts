import {
  daysUntil,
  documentReviewDue,
  isMaintenanceOverdue,
  recencyDue,
} from "@/lib/compliance";

/**
 * Attention flags.
 *
 * A flag is the red marker beside a row that says "this one, now". It is a
 * tighter signal than the amber "due soon" status: 60 days out is a planning
 * horizon, two weeks out is something you act on this fortnight.
 *
 * Every flag except one is derived from data the row already carries, so a
 * flag cannot linger after the thing that caused it is fixed — renew the
 * certificate and the flag is gone on the next render, with nothing to clear
 * by hand. The exception is a newly filed flight log, which has no state of
 * its own to read; see `acknowledged_at` on that table.
 */

/** How far ahead a deadline starts flagging. Two weeks, as agreed. */
export const FLAG_LEAD_DAYS = 14;

export type FlagSeverity = "overdue" | "attention";

export type Flag = {
  severity: FlagSeverity;
  /** Short, shown in the flag's tooltip and to screen readers. */
  label: string;
};

/**
 * A flag for a deadline, or null when it is far enough off to ignore.
 *
 * `subject` names the thing, not the row — "Recency", "Next service" — because
 * the row's own name is already on screen next to it.
 */
export function deadlineFlag(
  date: string | null,
  subject: string,
  now: Date = new Date(),
  leadDays: number = FLAG_LEAD_DAYS,
): Flag | null {
  const days = daysUntil(date, now);
  if (days === null) return null;

  if (days < 0) {
    const overdueBy = Math.abs(days);
    return {
      severity: "overdue",
      label: `${subject} overdue by ${overdueBy} day${overdueBy === 1 ? "" : "s"} (${date})`,
    };
  }
  if (days <= leadDays) {
    return {
      severity: "attention",
      label:
        days === 0
          ? `${subject} due today (${date})`
          : `${subject} due in ${days} day${days === 1 ? "" : "s"} (${date})`,
    };
  }
  return null;
}

export type PilotFlagInput = {
  certificate_expires: string | null;
  last_recency_activity: string | null;
  has_roc_a: boolean;
  certificate_type: string | null;
  active?: boolean;
};

/**
 * Pilot credential flags: certificate, recency, and the ROC-A on file.
 *
 * A missing ROC-A flags immediately rather than on a countdown — there is no
 * date to count toward, the certificate is simply not there. It is only a
 * problem for someone who is supposed to hold one, which is anyone certified
 * to operate: the radio licence goes with the flying, not with a date.
 */
export function pilotFlags(pilot: PilotFlagInput, now: Date = new Date()): Flag[] {
  if (pilot.active === false) return [];

  const flags: Flag[] = [];

  const certificate = deadlineFlag(pilot.certificate_expires, "RPAS certificate", now);
  if (certificate) flags.push(certificate);

  const recency = deadlineFlag(recencyDue(pilot.last_recency_activity), "Recency", now);
  if (recency) flags.push(recency);

  if (pilot.certificate_type && !pilot.has_roc_a) {
    flags.push({
      severity: "overdue",
      label: "ROC-A certificate not on file",
    });
  }

  return flags;
}

export type UavFlagInput = {
  status: string | null;
  next_inspection_date: string | null;
  hours_until_service: number | null;
};

/**
 * Airframe flags: the scheduled inspection and the hours-based interval.
 *
 * A grounded airframe flags on its own — it cannot fly, and that is worth
 * seeing without opening the row. A retired one never flags: it has left the
 * fleet and its dates stopped mattering the day it did.
 */
export function uavFlags(uav: UavFlagInput, now: Date = new Date()): Flag[] {
  if (uav.status === "retired") return [];

  const flags: Flag[] = [];

  if (uav.status === "grounded") {
    flags.push({ severity: "overdue", label: "Grounded — not available to fly" });
  }

  const inspection = deadlineFlag(uav.next_inspection_date, "Inspection", now);
  if (inspection) flags.push(inspection);

  // Hours have no calendar date, so the equivalent of "two weeks out" is the
  // last stretch of the interval. 25 hours is roughly a fortnight of flying.
  if (uav.hours_until_service !== null) {
    if (uav.hours_until_service <= 0) {
      flags.push({
        severity: "overdue",
        label: `Service overdue by ${Math.abs(Math.round(uav.hours_until_service * 10) / 10)} flight hours`,
      });
    } else if (uav.hours_until_service <= 25) {
      flags.push({
        severity: "attention",
        label: `${Math.round(uav.hours_until_service * 10) / 10} flight hours until service`,
      });
    }
  }

  return flags;
}

export type MaintenanceFlagInput = {
  status: string;
  next_service_date: string | null;
};

export function maintenanceFlags(
  record: MaintenanceFlagInput,
  now: Date = new Date(),
): Flag[] {
  if (record.status === "completed" || record.status === "cancelled") return [];

  if (isMaintenanceOverdue(record, now)) {
    return [
      {
        severity: "overdue",
        label: `Service overdue since ${record.next_service_date}`,
      },
    ];
  }

  const due = deadlineFlag(record.next_service_date, "Service", now);
  return due ? [due] : [];
}

export type DocumentFlagInput = {
  last_reviewed_at: string | null;
  effective_date: string | null;
  created_at?: string | null;
  review_interval_months: number | null;
  expires_at: string | null;
  approval_status?: string | null;
};

export function documentFlags(doc: DocumentFlagInput, now: Date = new Date()): Flag[] {
  const flags: Flag[] = [];

  const review = deadlineFlag(documentReviewDue(doc), "Review", now);
  if (review) flags.push(review);

  const expiry = deadlineFlag(doc.expires_at, "Document", now);
  if (expiry) flags.push(expiry);

  // Newly uploaded and not yet signed off: someone has to act on it.
  if (doc.approval_status === "pending_approval") {
    flags.push({ severity: "attention", label: "Waiting for approval" });
  }

  return flags;
}

export type FlightRequestFlagInput = {
  approval_status: string;
  requested_date: string | null;
};

/**
 * A pending request is the clearest case of "new data waiting on an
 * administrator", and it needs no acknowledgement column: approving or
 * rejecting it clears the flag, because the flag *is* the pending state.
 */
export function flightRequestFlags(
  request: FlightRequestFlagInput,
  now: Date = new Date(),
): Flag[] {
  if (request.approval_status !== "pending") return [];

  const days = daysUntil(request.requested_date, now);
  if (days !== null && days < 0) {
    return [{ severity: "overdue", label: "Requested date has passed, still unapproved" }];
  }
  return [{ severity: "attention", label: "Waiting for approval" }];
}

export type IncidentFlagInput = {
  status: string;
  severity: string;
};

export function incidentFlags(incident: IncidentFlagInput): Flag[] {
  if (incident.status === "closed") return [];

  const critical = incident.severity === "critical" || incident.severity === "high";
  return [
    {
      severity: critical ? "overdue" : "attention",
      label: incident.status === "open" ? "Open incident — not yet investigated" : "Under investigation",
    },
  ];
}

export type FlightLogFlagInput = {
  acknowledged_at: string | null;
};

/** The one flag that is stored rather than derived. */
export function flightLogFlags(log: FlightLogFlagInput): Flag[] {
  if (log.acknowledged_at) return [];
  return [{ severity: "attention", label: "Newly filed — not yet reviewed" }];
}

/** The worst severity present, for a row that carries several flags. */
export function worstSeverity(flags: Flag[]): FlagSeverity | null {
  if (flags.length === 0) return null;
  return flags.some((f) => f.severity === "overdue") ? "overdue" : "attention";
}
