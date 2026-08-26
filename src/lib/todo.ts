import {
  documentFlags,
  flightLogFlags,
  flightRequestFlags,
  incidentFlags,
  maintenanceFlags,
  pilotFlags,
  uavFlags,
  type Flag,
  type FlagSeverity,
  type DocumentFlagInput,
  type FlightLogFlagInput,
  type FlightRequestFlagInput,
  type IncidentFlagInput,
  type MaintenanceFlagInput,
  type PilotFlagInput,
  type UavFlagInput,
} from "@/lib/flags";
import { daysUntil, documentReviewDue, recencyDue } from "@/lib/compliance";

/**
 * The dashboard to-do list.
 *
 * The same flags that appear beside individual rows, gathered into one place
 * so someone can open the portal in the morning and see everything wanting
 * attention without visiting seven pages.
 *
 * Nothing here is a separate list to maintain: an item exists exactly as long
 * as the flag that produced it, so completing the work — renewing the
 * certificate, filing the ROC-A, closing the incident — removes it. There is
 * no "mark done", because marking something done without doing it is how a
 * to-do list stops being trusted.
 */

export type TodoItem = {
  id: string;
  severity: FlagSeverity;
  /** What the item is about: a pilot's name, a drone ID, a document title. */
  subject: string;
  /** What to do about it, taken straight from the flag. */
  reason: string;
  /** Where to go to deal with it. */
  href: string;
  area: string;
  /** Drives ordering; null sorts after anything dated. */
  dueDate: string | null;
};

export type TodoSource = {
  pilots?: (PilotFlagInput & { id: string; full_name: string })[];
  uavs?: (UavFlagInput & { id: string; drone_id: string })[];
  maintenance?: (MaintenanceFlagInput & { id: string; drone_id: string | null })[];
  requests?: (FlightRequestFlagInput & { id: string; pilot_name: string | null })[];
  logs?: (FlightLogFlagInput & { id: string; flight_date: string; pilot_name: string | null })[];
  incidents?: (IncidentFlagInput & { id: string; incident_date: string; incident_type: string })[];
  documents?: (DocumentFlagInput & { id: string; title: string })[];
};

function expand(
  flags: Flag[],
  base: Omit<TodoItem, "severity" | "reason" | "id"> & { id: string },
): TodoItem[] {
  // One to-do per reason, not per row: "certificate expired" and "recency
  // lapsed" are two separate jobs even though they belong to one pilot.
  return flags.map((flag, index) => ({
    ...base,
    id: `${base.id}:${index}`,
    severity: flag.severity,
    reason: flag.label,
  }));
}

export function buildTodoList(source: TodoSource, now: Date = new Date()): TodoItem[] {
  const items: TodoItem[] = [];

  for (const pilot of source.pilots ?? []) {
    // The nearest of the two credential dates orders the item; a missing ROC-A
    // has no date at all and falls back to null.
    const due = [pilot.certificate_expires, recencyDue(pilot.last_recency_activity)]
      .filter((d): d is string => d !== null)
      .sort()[0] ?? null;

    items.push(
      ...expand(pilotFlags(pilot, now), {
        id: `pilot-${pilot.id}`,
        subject: pilot.full_name,
        href: "/pilots",
        area: "Pilots & Crew",
        dueDate: due,
      }),
    );
  }

  for (const uav of source.uavs ?? []) {
    items.push(
      ...expand(uavFlags(uav, now), {
        id: `uav-${uav.id}`,
        subject: uav.drone_id,
        href: "/fleet",
        area: "UAV Fleet",
        dueDate: uav.next_inspection_date,
      }),
    );
  }

  for (const record of source.maintenance ?? []) {
    items.push(
      ...expand(maintenanceFlags(record, now), {
        id: `maintenance-${record.id}`,
        subject: record.drone_id ?? "Unassigned airframe",
        href: "/maintenance",
        area: "Maintenance",
        dueDate: record.next_service_date,
      }),
    );
  }

  for (const request of source.requests ?? []) {
    items.push(
      ...expand(flightRequestFlags(request, now), {
        id: `request-${request.id}`,
        subject: request.pilot_name ?? "Flight request",
        href: "/flights",
        area: "Flight Operations",
        dueDate: request.requested_date,
      }),
    );
  }

  for (const log of source.logs ?? []) {
    items.push(
      ...expand(flightLogFlags(log), {
        id: `log-${log.id}`,
        subject: `${log.pilot_name ?? "Flight"} — ${log.flight_date}`,
        href: "/flights",
        area: "Flight Operations",
        dueDate: log.flight_date,
      }),
    );
  }

  for (const incident of source.incidents ?? []) {
    items.push(
      ...expand(incidentFlags(incident), {
        id: `incident-${incident.id}`,
        subject: `${incident.incident_type.replace(/_/g, " ")} — ${incident.incident_date}`,
        href: "/incidents",
        area: "Incidents & Safety",
        dueDate: incident.incident_date,
      }),
    );
  }

  for (const doc of source.documents ?? []) {
    items.push(
      ...expand(documentFlags(doc, now), {
        id: `document-${doc.id}`,
        subject: doc.title,
        href: "/documents",
        area: "Documents",
        dueDate: doc.expires_at ?? documentReviewDue(doc),
      }),
    );
  }

  return sortTodos(items, now);
}

/**
 * Overdue before upcoming, then most urgent first.
 *
 * Within a severity the earliest date wins, so the thing that has been overdue
 * longest sits at the top rather than whichever table happened to be queried
 * first. Undated items — a missing document, an unreviewed log — sort last
 * within their group, since there is no deadline to be late against.
 */
export function sortTodos(items: TodoItem[], now: Date = new Date()): TodoItem[] {
  const severityRank: Record<FlagSeverity, number> = { overdue: 0, attention: 1 };

  return [...items].sort((a, b) => {
    const bySeverity = severityRank[a.severity] - severityRank[b.severity];
    if (bySeverity !== 0) return bySeverity;

    const aDays = daysUntil(a.dueDate, now);
    const bDays = daysUntil(b.dueDate, now);
    if (aDays === null && bDays === null) return a.subject.localeCompare(b.subject);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    if (aDays !== bDays) return aDays - bDays;
    return a.subject.localeCompare(b.subject);
  });
}

export function countBySeverity(items: TodoItem[]): Record<FlagSeverity, number> {
  return {
    overdue: items.filter((i) => i.severity === "overdue").length,
    attention: items.filter((i) => i.severity === "attention").length,
  };
}
