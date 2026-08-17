import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBarChart, type CategoryDatum } from "@/components/portal/analytics/category-bar-chart";
import { TrendChart, type TrendDatum } from "@/components/portal/analytics/trend-chart";
import { createClient } from "@/lib/supabase/server";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const statusColor = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const [uavsRes, pilotsRes, incidentsRes, auditsRes, maintenanceRes, flightLogsRes] = await Promise.all([
    supabase.from("uavs").select("status"),
    supabase.from("pilots").select("currency_status"),
    supabase.from("incidents").select("severity"),
    supabase.from("audits").select("compliance_status"),
    supabase.from("maintenance_records").select("maintenance_type, status, completed_date, next_service_date"),
    supabase.from("flight_logs").select("flight_date, duration_minutes"),
  ]);

  const uavs = uavsRes.data ?? [];
  const pilots = pilotsRes.data ?? [];
  const incidents = incidentsRes.data ?? [];
  const audits = auditsRes.data ?? [];
  const maintenance = maintenanceRes.data ?? [];
  const flightLogs = flightLogsRes.data ?? [];

  const currentYear = new Date().getFullYear();
  const flightHoursYtd =
    Math.round(
      (flightLogs
        .filter((f) => new Date(f.flight_date).getFullYear() === currentYear)
        .reduce((sum, f) => sum + (f.duration_minutes ?? 0), 0) /
        60) *
        10,
    ) / 10;

  const fleetUtilization = uavs.length > 0 ? Math.round((uavs.filter((u) => u.status === "active").length / uavs.length) * 100) : null;
  const pilotCompliance =
    pilots.length > 0 ? Math.round((pilots.filter((p) => p.currency_status === "current").length / pilots.length) * 100) : null;
  const incidentRate = flightLogs.length > 0 ? Math.round((incidents.length / flightLogs.length) * 100 * 10) / 10 : null;
  const scoredAudits = audits.filter((a) => a.compliance_status !== null);
  const auditPassRate =
    scoredAudits.length > 0
      ? Math.round((scoredAudits.filter((a) => a.compliance_status === "compliant").length / scoredAudits.length) * 100)
      : null;
  const completedWithDates = maintenance.filter((m) => m.status === "completed" && m.completed_date && m.next_service_date);
  const maintenanceOnTime =
    completedWithDates.length > 0
      ? Math.round(
          (completedWithDates.filter((m) => m.completed_date! <= m.next_service_date!).length / completedWithDates.length) * 100,
        )
      : null;

  const flightHoursByMonth: TrendDatum[] = monthLabels.map((label, i) => ({
    month: label,
    value:
      Math.round(
        (flightLogs
          .filter((f) => {
            const d = new Date(f.flight_date);
            return d.getFullYear() === currentYear && d.getMonth() === i;
          })
          .reduce((sum, f) => sum + (f.duration_minutes ?? 0), 0) /
          60) *
          10,
      ) / 10,
  }));

  const fleetStatusData: CategoryDatum[] = [
    { name: "Active", value: uavs.filter((u) => u.status === "active").length, color: statusColor.good },
    { name: "Maintenance", value: uavs.filter((u) => u.status === "maintenance").length, color: statusColor.warning },
    { name: "Grounded", value: uavs.filter((u) => u.status === "grounded").length, color: statusColor.critical },
  ];

  const incidentSeverityData: CategoryDatum[] = [
    { name: "Low", value: incidents.filter((i) => i.severity === "low").length, color: statusColor.good },
    { name: "Medium", value: incidents.filter((i) => i.severity === "medium").length, color: statusColor.warning },
    { name: "High", value: incidents.filter((i) => i.severity === "high").length, color: statusColor.serious },
    { name: "Critical", value: incidents.filter((i) => i.severity === "critical").length, color: statusColor.critical },
  ];

  const auditComplianceData: CategoryDatum[] = [
    { name: "Compliant", value: audits.filter((a) => a.compliance_status === "compliant").length, color: statusColor.good },
    { name: "At Risk", value: audits.filter((a) => a.compliance_status === "at_risk").length, color: statusColor.warning },
    { name: "Non-Compliant", value: audits.filter((a) => a.compliance_status === "non_compliant").length, color: statusColor.critical },
  ];

  const maintenanceTypeColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const maintenanceTypes = ["preventive", "repair", "calibration", "battery", "firmware"] as const;
  const maintenanceTypeData: CategoryDatum[] = maintenanceTypes.map((type, i) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: maintenance.filter((m) => m.maintenance_type === type).length,
    color: maintenanceTypeColors[i],
  }));

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Operational Intelligence"
        title="Analytics & Reporting Dashboard"
        subtitle="Operational intelligence — flight hours, fleet utilization, pilot compliance, incident trends, audit performance, and maintenance metrics at a glance."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricTile label="Total Flight Hours (YTD)" value={`${flightHoursYtd}`} tone="neutral" />
        <MetricTile
          label="Fleet Utilization Rate"
          value={fleetUtilization !== null ? `${fleetUtilization}%` : "—"}
          tone="neutral"
        />
        <MetricTile
          label="Pilot Compliance Score"
          value={pilotCompliance !== null ? `${pilotCompliance}%` : "—"}
          tone="neutral"
        />
        <MetricTile
          label="Incident Rate (per 100 flights)"
          value={incidentRate !== null ? `${incidentRate}` : "—"}
          tone="neutral"
        />
        <MetricTile
          label="Audit Pass Rate"
          value={auditPassRate !== null ? `${auditPassRate}%` : "—"}
          tone="neutral"
        />
        <MetricTile
          label="Maintenance On-Time Rate"
          value={maintenanceOnTime !== null ? `${maintenanceOnTime}%` : "—"}
          tone="neutral"
        />
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            Flight Hours by Month (YTD)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={flightHoursByMonth} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-[-0.01em]">
              Fleet Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={fleetStatusData} />
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-[-0.01em]">
              Incidents by Severity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={incidentSeverityData} />
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-[-0.01em]">
              Audit Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={auditComplianceData} />
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-[-0.01em]">
              Maintenance by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={maintenanceTypeData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
