/**
 * What the portal can hand a regulator.
 *
 * Every figure in these reports already existed; until now none of it could
 * leave the screen. Each report is defined once — id, title, columns — and
 * both the printable page and the CSV are generated from that definition, so
 * the two cannot show different things.
 */

export type ReportId =
  | "flight-log"
  | "pilot-currency"
  | "fleet-hours"
  | "maintenance-history"
  | "safety-record";

export type ReportColumn = {
  key: string;
  label: string;
  /** Right-aligned and tabular in the printed table. */
  numeric?: boolean;
};

export type ReportDef = {
  id: ReportId;
  title: string;
  /** What the report is for, in the words someone would use asking for it. */
  purpose: string;
  /** The permission area that governs whether this report may be run. */
  area: "logs" | "pilots" | "fleet" | "maintenance" | "incidents";
  columns: ReportColumn[];
};

export const reportDefs: ReportDef[] = [
  {
    id: "flight-log",
    title: "Flight register",
    purpose:
      "Every flight flown, with times, site, airspace and operation type. The record a Transport Canada review asks for first.",
    area: "logs",
    columns: [
      { key: "flight_date", label: "Date" },
      { key: "takeoff", label: "Takeoff" },
      { key: "landing", label: "Landing" },
      { key: "duration", label: "Duration (min)", numeric: true },
      { key: "pilot", label: "Pilot in command" },
      { key: "observers", label: "Visual observers" },
      { key: "drone", label: "Aircraft" },
      { key: "registration", label: "Registration" },
      { key: "site", label: "Site" },
      { key: "coordinates", label: "Coordinates" },
      { key: "airspace", label: "Airspace" },
      { key: "max_altitude", label: "Max alt (m)", numeric: true },
      { key: "operation", label: "Operation type" },
      { key: "sfoc", label: "SFOC" },
      { key: "outcome", label: "Outcome" },
    ],
  },
  {
    id: "pilot-currency",
    title: "Crew currency",
    purpose:
      "Certificate type, expiry, 24-month recency and ROC-A for every active pilot, with a plain verdict on whether they may fly.",
    area: "pilots",
    columns: [
      { key: "name", label: "Pilot" },
      { key: "certificate_type", label: "Certificate" },
      { key: "certificate_number", label: "Certificate #" },
      { key: "issued", label: "Issued" },
      { key: "expires", label: "Expires" },
      { key: "last_recency", label: "Last recency" },
      { key: "recency_due", label: "Recency due" },
      { key: "roc_a", label: "ROC-A on file" },
      { key: "verdict", label: "Valid to fly" },
    ],
  },
  {
    id: "fleet-hours",
    title: "Fleet and flight hours",
    purpose:
      "Each airframe with its registration, accumulated hours, service position and current airworthiness state.",
    area: "fleet",
    columns: [
      { key: "drone_id", label: "Aircraft" },
      { key: "registration", label: "Registration" },
      { key: "serial", label: "Serial" },
      { key: "make_model", label: "Make / model" },
      { key: "weight", label: "Weight (kg)", numeric: true },
      { key: "status", label: "Status" },
      { key: "flight_hours", label: "Total hours", numeric: true },
      { key: "hours_since_service", label: "Since service", numeric: true },
      { key: "hours_until_service", label: "Until service", numeric: true },
      { key: "last_maintenance", label: "Last service" },
      { key: "next_inspection", label: "Next inspection" },
    ],
  },
  {
    id: "maintenance-history",
    title: "Maintenance history",
    purpose:
      "Every service record with type, technician, scheduled and completed dates, and the airframe hours at which it was carried out.",
    area: "maintenance",
    columns: [
      { key: "drone_id", label: "Aircraft" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "next_service_date", label: "Scheduled" },
      { key: "completed_date", label: "Completed" },
      { key: "hours_at_service", label: "Hours at service", numeric: true },
      { key: "technician", label: "Technician" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    id: "safety-record",
    title: "Safety record",
    purpose:
      "Incidents and open audit findings together — what happened, how severe, and what is still outstanding against it.",
    area: "incidents",
    columns: [
      { key: "kind", label: "Record" },
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "severity", label: "Severity" },
      { key: "status", label: "Status" },
      { key: "subject", label: "Aircraft / owner" },
      { key: "detail", label: "Detail" },
    ],
  },
];

export function reportDef(id: string): ReportDef | null {
  return reportDefs.find((r) => r.id === id) ?? null;
}
