import { Lock } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { SectionLabel } from "@/components/portal/section-label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IncidentsTable, type IncidentRow } from "@/components/portal/incidents/incidents-table";
import { ReportIncidentDialog } from "@/components/portal/incidents/report-incident-dialog";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";

export default async function IncidentsPage() {
  const supabase = await createClient();
  const [access, incidentsRes, pilotsRes, uavsRes] = await Promise.all([
    getAccess(),
    supabase
      .from("incidents")
      .select(
        "id, incident_date, incident_type, severity, status, is_anonymous, uavs(drone_id), pilots(full_name)",
      )
      .order("incident_date", { ascending: false })
,
    // Departed crew are not offered: you cannot assign new work to someone
    // who has left, and their record stays only for the history.
    supabase.from("pilots").select("id, full_name").eq("active", true).order("full_name"),
    // Retired airframes likewise — they are kept for their logs, not to fly.
    supabase.from("uavs").select("id, drone_id").neq("status", "retired").order("drone_id"),
  ]);

  const incidents = incidentsRes.data ?? [];
  const pilotOptions = (pilotsRes.data ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const uavOptions = (uavsRes.data ?? []).map((u) => ({ id: u.id, label: u.drone_id }));
  const canManage = access?.canManage("incidents") ?? false;

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
      <HeroBand
        eyebrow="Safety Reporting"
        title="Incidents & Safety Reporting"
        subtitle="Report near misses, crashes, equipment failures, safety hazards, and regulatory breaches. Every report drives continuous safety improvement."
      />

      <Card className="border-[var(--status-critical)]/30">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <ReportIncidentDialog pilots={pilotOptions} uavs={uavOptions} />
          <p className="max-w-md text-sm text-muted-foreground">
            Use this button to submit a new incident report. All employees are encouraged to report safety
            concerns — anonymous reporting is supported. High-severity incidents should be escalated
            immediately.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricTile
          label="Open Incidents"
          value={`${openIncidents}`}
          tone={openIncidents > 0 ? "critical" : "good"}
        />
        <MetricTile label="Under Investigation" value={`${underInvestigation}`} tone="neutral" />
        <MetricTile label="Closed (YTD)" value={`${closedYtd}`} tone="good" />
        <MetricTile
          label="Days Since Last Incident"
          value={daysSinceLastIncident !== null ? `${daysSinceLastIncident}` : "—"}
          tone="neutral"
        />
        <MetricTile label="Near Miss Reports (YTD)" value={`${nearMissYtd}`} tone="neutral" />
      </div>

      <div>
        <SectionLabel>Recent Incidents</SectionLabel>
        <IncidentsTable rows={incidents} canManage={canManage} />
      </div>

      <Alert>
        <Lock />
        <AlertTitle>Restricted data</AlertTitle>
        <AlertDescription>
          Who can see and act on incident data is set by the &ldquo;Incidents &amp; safety&rdquo; row
          of the access matrix. Anonymous reports are supported for safety hazards and near misses.
        </AlertDescription>
      </Alert>
    </div>
  );
}
