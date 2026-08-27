import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { reportDef, type ReportDef, type ReportId } from "@/lib/report-defs";
import {
  certificateTypeLabel,
  derivePilotCertificateStatus,
  recencyDue,
  todayIso,
} from "@/lib/compliance";

export type ReportRow = Record<string, string | number | boolean | null>;

export type ReportResult =
  | { error: string; def: null; rows: null }
  | { error: null; def: ReportDef; rows: ReportRow[] };

const airspaceLabel: Record<string, string> = {
  uncontrolled: "Uncontrolled (G)",
  controlled: "Controlled",
  restricted: "Restricted",
  advisory: "Advisory",
};

/** The operation categories, as a single readable cell. */
function operationType(row: {
  is_night: boolean | null;
  is_bvlos: boolean | null;
  is_over_people: boolean | null;
  is_sheltered: boolean | null;
}): string {
  const parts: string[] = [];
  if (row.is_bvlos) parts.push("BVLOS");
  if (row.is_night) parts.push("Night");
  if (row.is_over_people) parts.push("Over people");
  if (row.is_sheltered) parts.push("Sheltered");
  return parts.length > 0 ? parts.join(", ") : "Standard VLOS";
}

function clockOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function round1(n: number | null): number | null {
  return n === null ? null : Math.round(n * 10) / 10;
}

/**
 * Runs a report.
 *
 * Row-level security already limits every query to what the viewer may see, so
 * a report cannot leak past a person's permissions. The area check on top
 * refuses the whole report rather than quietly returning a shorter one, since
 * a partial compliance record handed to a regulator is worse than none.
 */
export async function runReport(id: string): Promise<ReportResult> {
  const def = reportDef(id);
  if (!def) return { error: "That report does not exist.", def: null, rows: null };

  const access = await getAccess();
  if (!access) return { error: "You are not signed in.", def: null, rows: null };
  if (!access.canReadAll(def.area)) {
    return {
      error: `You can only run the ${def.title.toLowerCase()} report with full visibility of ${def.area}.`,
      def: null,
      rows: null,
    };
  }

  const supabase = await createClient();

  switch (def.id as ReportId) {
    case "flight-log": {
      const { data } = await supabase
        .from("flight_logs")
        .select(
          "id, flight_date, takeoff_at, landing_at, effective_duration_minutes, location_name, latitude, longitude, airspace, max_altitude_m, is_night, is_bvlos, is_over_people, is_sheltered, sfoc_reference, mission_outcome, pilots(full_name), uavs(drone_id, registration_number), flight_crew(role, pilots(full_name))",
        )
        .order("flight_date", { ascending: false });

      return {
        error: null,
        def,
        rows: (data ?? []).map((r) => ({
          flight_date: r.flight_date,
          takeoff: clockOf(r.takeoff_at),
          landing: clockOf(r.landing_at),
          duration: r.effective_duration_minutes,
          pilot: r.pilots?.full_name ?? null,
          observers:
            (r.flight_crew ?? [])
              .filter((c) => c.role === "visual_observer")
              .map((c) => c.pilots?.full_name)
              .filter(Boolean)
              .join(", ") || null,
          drone: r.uavs?.drone_id ?? null,
          registration: r.uavs?.registration_number ?? null,
          site: r.location_name,
          coordinates:
            r.latitude !== null && r.longitude !== null ? `${r.latitude}, ${r.longitude}` : null,
          airspace: r.airspace ? (airspaceLabel[r.airspace] ?? r.airspace) : null,
          max_altitude: r.max_altitude_m,
          operation: operationType(r),
          sfoc: r.sfoc_reference,
          outcome: r.mission_outcome,
        })),
      };
    }

    case "pilot-currency": {
      const { data } = await supabase
        .from("pilot_certificate_status")
        .select(
          "full_name, certificate_type, certificate_number, certificate_issued, certificate_expires, last_recency_activity, has_roc_a, active",
        )
        .eq("active", true)
        .order("full_name");

      return {
        error: null,
        def,
        rows: (data ?? []).map((p) => {
          const status = derivePilotCertificateStatus(
            p.certificate_expires,
            p.last_recency_activity,
          );
          return {
            name: p.full_name,
            certificate_type: p.certificate_type
              ? (certificateTypeLabel[p.certificate_type] ?? p.certificate_type)
              : null,
            certificate_number: p.certificate_number,
            issued: p.certificate_issued,
            expires: p.certificate_expires,
            last_recency: p.last_recency_activity,
            recency_due: recencyDue(p.last_recency_activity),
            roc_a: p.has_roc_a ?? false,
            // Stated plainly rather than as a status code: this is the line a
            // reviewer reads, and "due_soon" is not an answer to "may they fly".
            verdict:
              status === null
                ? "No credentials on file"
                : status === "expired"
                  ? "No — expired"
                  : status === "due_soon"
                    ? "Yes — renewal due"
                    : "Yes",
          };
        }),
      };
    }

    case "fleet-hours": {
      const { data } = await supabase
        .from("uav_fleet_status")
        .select(
          "drone_id, registration_number, serial_number, model, manufacturer, weight_kg, status, flight_hours, hours_since_service, hours_until_service, last_maintenance_date, next_inspection_date",
        )
        .order("drone_id");

      return {
        error: null,
        def,
        rows: (data ?? []).map((u) => ({
          drone_id: u.drone_id,
          registration: u.registration_number,
          serial: u.serial_number,
          make_model: [u.manufacturer, u.model].filter(Boolean).join(" ") || null,
          weight: u.weight_kg,
          status: u.status,
          flight_hours: round1(u.flight_hours),
          hours_since_service: round1(u.hours_since_service),
          hours_until_service: round1(u.hours_until_service),
          last_maintenance: u.last_maintenance_date,
          next_inspection: u.next_inspection_date,
        })),
      };
    }

    case "maintenance-history": {
      const { data } = await supabase
        .from("maintenance_records")
        .select(
          "maintenance_type, status, next_service_date, completed_date, flight_hours_at_service, notes, uavs(drone_id), technician:maintenance_records_technician_id_fkey(full_name)",
        )
        .order("completed_date", { ascending: false, nullsFirst: false });

      return {
        error: null,
        def,
        rows: (data ?? []).map((m) => ({
          drone_id: m.uavs?.drone_id ?? null,
          type: m.maintenance_type,
          status: m.status,
          next_service_date: m.next_service_date,
          completed_date: m.completed_date,
          hours_at_service: round1(m.flight_hours_at_service),
          technician: m.technician?.full_name ?? null,
          notes: m.notes,
        })),
      };
    }

    case "safety-record": {
      const [incidents, findings] = await Promise.all([
        supabase
          .from("incidents")
          .select(
            "incident_date, incident_type, severity, status, description, is_anonymous, uavs(drone_id)",
          )
          .order("incident_date", { ascending: false }),
        supabase
          .from("audit_findings")
          .select("severity, description, due_date, status, assignee:audit_findings_assigned_to_fkey(full_name)")
          .neq("status", "closed")
          .order("due_date"),
      ]);

      const rows: ReportRow[] = [
        ...(incidents.data ?? []).map((i) => ({
          kind: "Incident",
          date: i.incident_date,
          type: i.incident_type,
          severity: i.severity,
          status: i.status,
          subject: i.uavs?.drone_id ?? (i.is_anonymous ? "Anonymous report" : null),
          detail: i.description,
        })),
        ...(findings.data ?? []).map((f) => ({
          kind: "Open finding",
          date: f.due_date,
          type: "Audit finding",
          severity: f.severity,
          status: f.status,
          subject: f.assignee?.full_name ?? "Unassigned",
          detail: f.description,
        })),
      ];

      return { error: null, def, rows };
    }
  }
}

/** Used in the report header, so a printed copy says when it was produced. */
export function reportStamp(): string {
  return todayIso();
}
