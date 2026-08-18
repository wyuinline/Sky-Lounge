import Link from "next/link";
import { Send, ShieldAlert, Wrench, Upload, ClipboardCheck, Users, Plane, AlertTriangle } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { StatusDot } from "@/components/portal/status-dot";
import { SectionLabel } from "@/components/portal/section-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDashboardData } from "./dashboard-data";

const quickActions = [
  { title: "Submit Flight Request", href: "/flights", icon: Send },
  { title: "Report Incident", href: "/incidents", icon: ShieldAlert },
  { title: "Log Maintenance", href: "/maintenance", icon: Wrench },
  { title: "Upload Document", href: "/documents", icon: Upload },
  { title: "View Audit Schedule", href: "/audits", icon: ClipboardCheck },
  { title: "Check Pilot Status", href: "/pilots", icon: Users },
];

function relativeDate(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

const activityIcon = {
  flight: Plane,
  maintenance: Wrench,
  incident: ShieldAlert,
};

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Site Status Overview"
        title="UAV Operations Dashboard"
        subtitle="Real-time operational overview for fleet, pilots, compliance, and safety."
      />

      {data.status === "schema-missing" && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Database not set up yet</AlertTitle>
          <AlertDescription>
            The tables this portal reads don&apos;t exist yet, so the figures below are empty. An
            administrator needs to apply the database migrations.
          </AlertDescription>
        </Alert>
      )}

      {data.status === "error" && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Couldn&apos;t load operational data</AlertTitle>
          <AlertDescription>
            The figures below may be incomplete or out of date. Refresh to try again, and contact your
            administrator if this keeps happening.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="group h-full gap-0 overflow-hidden rounded-md border-border py-0 transition-colors hover:border-brand-teal/50 hover:bg-brand-mist/50">
                <div className="h-1 w-full bg-brand-sage transition-colors group-hover:bg-brand-lime" />
                <CardContent className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                  <action.icon className="size-5 text-brand-teal" />
                  <span className="text-xs font-medium">
                    {action.title}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Key Metrics</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricTile
            label="Compliance Score"
            value={data.complianceScore !== null ? `${data.complianceScore}%` : "—"}
            tone="neutral"
          />
          <MetricTile label="Total Fleet" value={`${data.fleetTotal}`} tone="neutral" />
          <MetricTile label="Active Pilots" value={`${data.activePilots}`} tone="neutral" />
          <MetricTile label="Flight Hours (YTD)" value={`${data.flightHoursYtd}`} tone="neutral" />
          <MetricTile
            label="Open Incidents"
            value={`${data.openIncidents}`}
            tone={data.openIncidents > 0 ? "critical" : "good"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-[-0.01em]">
              Alerts &amp; Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
              <StatusDot
                tone={data.expiringCertifications > 0 ? "warning" : "good"}
                label="Expiring certifications (30 days)"
              />
              <span className="text-sm font-semibold tabular-nums">{data.expiringCertifications}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
              <StatusDot tone="neutral" label="Upcoming audits" />
              <span className="text-sm font-semibold tabular-nums">{data.upcomingAudits}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
              <StatusDot
                tone={data.overdueMaintenance > 0 ? "critical" : "good"}
                label="Overdue maintenance"
              />
              <span className="text-sm font-semibold tabular-nums">{data.overdueMaintenance}</span>
            </div>
            <div className="flex items-center justify-between pb-0 text-sm">
              <StatusDot
                tone={data.recentIncidents > 0 ? "critical" : "good"}
                label="Recent incidents (7 days)"
              />
              <span className="text-sm font-semibold tabular-nums">{data.recentIncidents}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-[-0.01em]">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.activity.map((item) => {
                  const Icon = activityIcon[item.type];
                  return (
                    <li key={item.id} className="flex items-start gap-3 text-sm">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeDate(item.date)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
