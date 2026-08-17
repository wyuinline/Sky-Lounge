import { ShieldAlert, Search, CheckCircle2, Calendar, Eye, Lock } from "lucide-react";
import { PageHero } from "@/components/portal/page-hero";
import { StatCard } from "@/components/portal/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IncidentsTable, type IncidentRow } from "@/components/portal/incidents/incidents-table";
import { ReportIncidentDialog } from "@/components/portal/incidents/report-incident-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

export default async function IncidentsPage() {
  const supabase = await createClient();
  const [profile, incidentsRes, pilotsRes, uavsRes] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("incidents")
      .select(
        "id, incident_date, incident_type, severity, status, is_anonymous, uavs(drone_id), pilots(full_name)",
      )
      .order("incident_date", { ascending: false })
      .returns<IncidentRow[]>(),
    supabase.from("pilots").select("id, full_name").order("full_name"),
    supabase.from("uavs").select("id, drone_id").order("drone_id"),
  ]);

  const incidents = incidentsRes.data ?? [];
  const pilotOptions = (pilotsRes.data ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const uavOptions = (uavsRes.data ?? []).map((u) => ({ id: u.id, label: u.drone_id }));
  const canManage = profile ? ["uav_admin", "ops_manager"].includes(profile.role) : false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const openIncidents = incidents.filter((i) => i.status !== "closed").length;
  const underInvestigation = incidents.filter((i) => i.status === "investigating").length;
  const closedYtd = incidents.filter(
    (i) => i.status === "closed" && new Date(i.incident_date).getFullYear() === currentYear,
  ).length;
  const nearMissYtd = incidents.filter(
    (i) => i.incident_type === "near_miss" && new Date(i.incident_date).getFullYear() === currentYear,
  ).length;
  const lastIncidentDate = incidents
    .map((i) => i.incident_date)
    .sort((a, b) => b.localeCompare(a))[0];
  const daysSinceLastIncident = lastIncidentDate
    ? Math.floor((now.getTime() - new Date(lastIncidentDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        title="Incidents & Safety Reporting"
        subtitle="Report near misses, crashes, equipment failures, safety hazards, and regulatory breaches. Every report drives continuous safety improvement."
      />

      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <ReportIncidentDialog pilots={pilotOptions} uavs={uavOptions} />
          <p className="max-w-md text-sm text-muted-foreground">
            Use this button to submit a new incident report. All employees are encouraged to report safety
            concerns — anonymous reporting is supported. High-severity incidents should be escalated
            immediately.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Open Incidents"
          value={`${openIncidents}`}
          icon={ShieldAlert}
          tone={openIncidents > 0 ? "critical" : "default"}
        />
        <StatCard label="Under Investigation" value={`${underInvestigation}`} icon={Search} />
        <StatCard label="Closed (YTD)" value={`${closedYtd}`} icon={CheckCircle2} />
        <StatCard
          label="Days Since Last Incident"
          value={daysSinceLastIncident !== null ? `${daysSinceLastIncident}` : "—"}
          icon={Calendar}
        />
        <StatCard label="Near Miss Reports (YTD)" value={`${nearMissYtd}`} icon={Eye} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent Incidents</h2>
        <IncidentsTable rows={incidents} canManage={canManage} />
      </div>

      <Alert>
        <Lock />
        <AlertTitle>Restricted data</AlertTitle>
        <AlertDescription>
          Incident data is restricted to administrators, operations managers, auditors, and the
          maintenance team. Anonymous reports are supported for safety hazards and near misses.
        </AlertDescription>
      </Alert>
    </div>
  );
}
