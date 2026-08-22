import { createClient } from "@/lib/supabase/server";

type FlightLogActivityRow = {
  id: string;
  flight_date: string;
  duration_minutes: number | null;
  created_at: string;
  pilots: { full_name: string | null } | null;
  uavs: { drone_id: string } | null;
};

type MaintenanceActivityRow = {
  id: string;
  maintenance_type: string;
  status: string;
  created_at: string;
  uavs: { drone_id: string } | null;
};

type IncidentActivityRow = {
  id: string;
  incident_type: string;
  severity: string;
  created_at: string;
  uavs: { drone_id: string } | null;
};

/**
 * "schema-missing" means the migration genuinely hasn't run (Postgres 42P01).
 * "error" is anything else — an outage, an RLS denial — where telling the user
 * to run a migration against a live database would be actively wrong.
 */
export type DashboardStatus = "ok" | "schema-missing" | "error";

export type DashboardData = {
  ready: boolean;
  status: DashboardStatus;
  fleetTotal: number;
  fleetActive: number;
  fleetMaintenance: number;
  fleetGrounded: number;
  activePilots: number;
  flightHoursYtd: number;
  openIncidents: number;
  complianceScore: number | null;
  expiringCertifications: number;
  upcomingAudits: number;
  overdueMaintenance: number;
  recentIncidents: number;
  activity: ActivityItem[];
};

export type ActivityItem = {
  id: string;
  type: "flight" | "maintenance" | "incident";
  title: string;
  subtitle: string;
  date: string;
};

const empty: DashboardData = {
  ready: false,
  status: "schema-missing",
  fleetTotal: 0,
  fleetActive: 0,
  fleetMaintenance: 0,
  fleetGrounded: 0,
  activePilots: 0,
  flightHoursYtd: 0,
  openIncidents: 0,
  complianceScore: null,
  expiringCertifications: 0,
  upcomingAudits: 0,
  overdueMaintenance: 0,
  recentIncidents: 0,
  activity: [],
};

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  // Probe first so a missing schema renders an empty state instead of crashing.
  // 42P01 (undefined_table) is the only error that actually means "migration
  // not applied"; everything else is reported as a generic failure.
  const probe = await supabase.from("uavs").select("id", { count: "exact", head: true });
  if (probe.error) {
    console.error("[dashboard] probe failed", probe.error);
    return { ...empty, status: probe.error.code === "42P01" ? "schema-missing" : "error" };
  }

  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    fleetRows,
    pilotsCount,
    flightMinutes,
    openIncidentsCount,
    audits,
    expiringCerts,
    upcomingAudits,
    overdueMaintenance,
    recentIncidentsCount,
    recentFlights,
    recentMaintenance,
    recentIncidentsList,
  ] = await Promise.all([
    supabase.from("uavs").select("status"),
    supabase.from("pilots").select("id", { count: "exact", head: true }),
    supabase.from("flight_logs").select("duration_minutes").gte("flight_date", startOfYear),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "investigating", "escalated"]),
    supabase.from("audits").select("compliance_status").not("compliance_status", "is", null),
    supabase
      .from("training_records")
      .select("id", { count: "exact", head: true })
      .gte("expiry_date", todayStr)
      .lte("expiry_date", in30Days),
    supabase
      .from("audits")
      .select("id", { count: "exact", head: true })
      .eq("status", "planned")
      .gte("audit_date", todayStr)
      .lte("audit_date", in30Days),
    // Overdue is derived from the service date, not the stored status, which
    // is never advanced to 'overdue'. Filtering on it always returned zero.
    supabase
      .from("maintenance_records")
      .select("id", { count: "exact", head: true })
      .neq("status", "completed")
      .not("next_service_date", "is", null)
      .lt("next_service_date", todayStr),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("flight_logs")
      .select("id, flight_date, duration_minutes, created_at, pilots(full_name), uavs(drone_id)")
      .order("created_at", { ascending: false })
      .limit(3)
,
    supabase
      .from("maintenance_records")
      .select("id, maintenance_type, status, created_at, uavs(drone_id)")
      .order("created_at", { ascending: false })
      .limit(3)
,
    supabase
      .from("incidents")
      .select("id, incident_type, severity, created_at, uavs(drone_id)")
      .order("created_at", { ascending: false })
      .limit(3)
,
  ]);

  const fleet = fleetRows.data ?? [];
  const compliance = audits.data ?? [];
  const complianceScore =
    compliance.length > 0
      ? Math.round(
          (compliance.filter((a) => a.compliance_status === "compliant").length / compliance.length) * 100,
        )
      : null;

  const activity: ActivityItem[] = [
    ...(recentFlights.data ?? []).map((row) => ({
      id: `flight-${row.id}`,
      type: "flight" as const,
      title: `Flight logged — ${row.uavs?.drone_id ?? "UAV"}`,
      subtitle: `${row.pilots?.full_name ?? "Pilot"} · ${row.duration_minutes ?? 0} min`,
      date: row.created_at,
    })),
    ...(recentMaintenance.data ?? []).map((row) => ({
      id: `maintenance-${row.id}`,
      type: "maintenance" as const,
      title: `Maintenance ${row.status} — ${row.uavs?.drone_id ?? "UAV"}`,
      subtitle: row.maintenance_type,
      date: row.created_at,
    })),
    ...(recentIncidentsList.data ?? []).map((row) => ({
      id: `incident-${row.id}`,
      type: "incident" as const,
      title: `${row.incident_type.replace("_", " ")} reported — ${row.uavs?.drone_id ?? "UAV"}`,
      subtitle: `Severity: ${row.severity}`,
      date: row.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return {
    ready: true,
    status: "ok",
    fleetTotal: fleet.length,
    fleetActive: fleet.filter((u) => u.status === "airworthy").length,
    fleetMaintenance: fleet.filter((u) => u.status === "maintenance").length,
    fleetGrounded: fleet.filter((u) => u.status === "grounded").length,
    activePilots: pilotsCount.count ?? 0,
    flightHoursYtd: Math.round(
      ((flightMinutes.data ?? []).reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0) / 60) * 10,
    ) / 10,
    openIncidents: openIncidentsCount.count ?? 0,
    complianceScore,
    expiringCertifications: expiringCerts.count ?? 0,
    upcomingAudits: upcomingAudits.count ?? 0,
    overdueMaintenance: overdueMaintenance.count ?? 0,
    recentIncidents: recentIncidentsCount.count ?? 0,
    activity,
  };
}
