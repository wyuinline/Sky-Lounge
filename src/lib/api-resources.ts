/**
 * What the read API exposes.
 *
 * One table here, so adding an endpoint is a data change rather than a new
 * route — and so the whole surface can be read at a glance when someone asks
 * "what can a key with the pilots scope actually see?".
 *
 * Columns are listed explicitly rather than selected with `*`. A future
 * migration that adds a sensitive column would otherwise publish it to every
 * existing integration the moment it landed.
 */

import type { ApiScope } from "@/lib/api-keys";
import type { Database } from "@/lib/database.types";

/**
 * Anything the API may read. Typed against the generated schema so a renamed
 * view breaks the build rather than the integration.
 */
export type ApiSource =
  | keyof Database["public"]["Tables"]
  | keyof Database["public"]["Views"];

export type ApiResource = {
  /** The path segment: /api/v1/<name>. */
  name: string;
  /** The scope a key needs. */
  scope: ApiScope;
  /** Table or view to read. */
  from: ApiSource;
  /** PostgREST select string. Explicit, never "*". */
  select: string;
  /** Default ordering, newest or most relevant first. */
  orderBy: string;
  ascending: boolean;
  /** The column `from`/`to` filter on, where a date range makes sense. */
  dateColumn: string | null;
  description: string;
  /** Rows the API must never serve, whatever the key's scope. */
  exclude?: { column: string; values: string[] };
};

export const apiResources: ApiResource[] = [
  {
    name: "flights",
    scope: "logs",
    from: "flight_logs",
    select:
      "id, flight_date, takeoff_at, landing_at, duration_minutes, effective_duration_minutes, " +
      "location_name, latitude, longitude, max_altitude_m, airspace, is_night, is_bvlos, " +
      "is_over_people, mission_outcome, weather_conditions, wind_speed_kt, temperature_c, " +
      "flight_category, pilots(full_name), uavs(drone_id, model), projects(project_code, name)",
    orderBy: "flight_date",
    ascending: false,
    dateColumn: "flight_date",
    description: "Flight records, with derived duration and the aircraft, pilot and project flown.",
  },
  {
    name: "fleet",
    scope: "fleet",
    from: "uav_fleet_status",
    select:
      "id, drone_id, model, manufacturer, serial_number, registration_number, status, " +
      "weight_kg, location_site, flight_hours, hours_since_service, hours_until_service, " +
      "maintenance_interval_hours, last_maintenance_date, next_inspection_date, " +
      "assigned_pilot_name, purchased_date",
    orderBy: "drone_id",
    ascending: true,
    dateColumn: "next_inspection_date",
    description: "Aircraft with derived airframe hours and how far they are from their next service.",
  },
  {
    name: "pilots",
    scope: "pilots",
    // Certificate numbers and free-text notes are deliberately absent: an
    // integration wants currency, not a copy of someone's licence.
    from: "pilot_certificate_status",
    select:
      "id, full_name, active, certificate_type, certificate_issued, certificate_expires, " +
      "recency_due, last_recency_activity, has_roc_a, flight_hours",
    orderBy: "full_name",
    ascending: true,
    dateColumn: "certificate_expires",
    description: "Crew with derived certificate and recency due dates. No certificate numbers.",
  },
  {
    name: "maintenance",
    scope: "maintenance",
    from: "maintenance_records",
    select:
      "id, maintenance_type, status, completed_date, next_service_date, " +
      "flight_hours_at_service, notes, created_at, uavs(drone_id, model)",
    orderBy: "created_at",
    ascending: false,
    dateColumn: "next_service_date",
    description: "Maintenance records, scheduled and completed.",
  },
  {
    name: "batteries",
    scope: "fleet",
    from: "battery_status_view",
    select:
      "id, battery_id, model, manufacturer, serial_number, status, capacity_mah, cell_count, " +
      "total_cycles, cycle_limit, cycles_remaining, age_months, last_used_on, location_site",
    orderBy: "battery_id",
    ascending: true,
    dateColumn: "last_used_on",
    description: "Packs with cycles derived from flight usage rather than a counter.",
  },
  {
    name: "components",
    scope: "fleet",
    from: "component_status_view",
    select:
      "id, component_id, name, category, model, manufacturer, serial_number, status, " +
      "total_hours, service_interval_hours, hours_until_service, fitted_to, fitted_on",
    orderBy: "component_id",
    ascending: true,
    dateColumn: "fitted_on",
    description: "Life-limited parts with hours derived from the flights they were fitted for.",
  },
  {
    name: "projects",
    scope: "logs",
    from: "project_summary",
    select:
      "id, project_code, name, client_name, site_name, status, start_date, end_date, " +
      "flight_count, flight_hours, estimated_cost, first_flight, last_flight",
    orderBy: "project_code",
    ascending: true,
    dateColumn: "start_date",
    description: "Projects with hours and cost derived from the flights booked to them.",
  },
  {
    name: "incidents",
    scope: "incidents",
    from: "incidents",
    // Neither reported_by nor pilot_id is exposed. Anonymous reporting only
    // works if it stays anonymous everywhere, including here.
    select:
      "id, incident_date, incident_type, severity, status, description, created_at, " +
      "uavs(drone_id, model)",
    orderBy: "incident_date",
    ascending: false,
    dateColumn: "incident_date",
    description: "Safety occurrences. Reporter identity is never exposed.",
  },
  {
    name: "documents",
    scope: "docs_general",
    // Restricted categories are excluded at the query, not by scope alone.
    from: "document_review_status",
    // storage_path is withheld: a path is a thing to probe, and the API serves
    // metadata, not files.
    select:
      "id, title, category, department, version, effective_date, expires_at, " +
      "last_reviewed_at, review_due, review_interval_months, approval_status, uav_model",
    orderBy: "review_due",
    ascending: true,
    dateColumn: "review_due",
    description: "General documents with derived review dates. Restricted categories are excluded.",
    // The docs_restricted scope is not offered to keys at all; excluding the
    // rows here means a mis-set scope cannot leak them either.
    exclude: { column: "category", values: ["regulatory", "incident_report"] },
  },
];

export function findResource(name: string): ApiResource | null {
  return apiResources.find((r) => r.name === name) ?? null;
}

/** The index the API serves at /api/v1, so a key holder can discover the rest. */
export function describeApi(): {
  version: string;
  resources: { name: string; scope: string; path: string; description: string; filters: string[] }[];
} {
  return {
    version: "v1",
    resources: apiResources.map((r) => ({
      name: r.name,
      scope: r.scope,
      path: `/api/v1/${r.name}`,
      description: r.description,
      filters: [
        "limit",
        "offset",
        ...(r.dateColumn ? [`from (${r.dateColumn})`, `to (${r.dateColumn})`] : []),
        "format=json|csv",
      ],
    })),
  };
}
