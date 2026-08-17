import Link from "next/link";
import {
  Send,
  ShieldAlert,
  Wrench,
  Upload,
  ClipboardCheck,
  Users,
  Plane,
  Activity,
  AlertTriangle,
  FileWarning,
  Clock,
} from "lucide-react";
import { PageHero } from "@/components/portal/page-hero";
import { StatCard } from "@/components/portal/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
      <PageHero
        title="UAV Operations Dashboard"
        subtitle="Real-time operational overview for fleet, pilots, compliance, and safety."
      />

      {!data.ready && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Database not connected yet</AlertTitle>
          <AlertDescription>
            The schema migration hasn&apos;t been applied to Supabase yet, so this dashboard is showing an
            empty state. Run <code>supabase/migrations/20260817000000_init_schema.sql</code> against your
            project to see live data.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent">
                <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                  <action.icon className="size-5 text-primary" />
                  <span className="text-xs font-medium">{action.title}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Compliance Score"
          value={data.complianceScore !== null ? `${data.complianceScore}%` : "—"}
          icon={ClipboardCheck}
        />
        <StatCard label="Total Fleet" value={`${data.fleetTotal} UAVs`} icon={Plane} />
        <StatCard label="Active Pilots" value={`${data.activePilots}`} icon={Users} />
        <StatCard label="Flight Hours (YTD)" value={`${data.flightHoursYtd}`} icon={Activity} />
        <StatCard
          label="Open Incidents"
          value={`${data.openIncidents}`}
          icon={ShieldAlert}
          tone={data.openIncidents > 0 ? "critical" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts &amp; Notifications</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" /> Expiring certifications (30 days)
              </span>
              <Badge variant={data.expiringCertifications > 0 ? "destructive" : "secondary"}>
                {data.expiringCertifications}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-muted-foreground" /> Upcoming audits
              </span>
              <Badge variant="secondary">{data.upcomingAudits}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <FileWarning className="size-4 text-muted-foreground" /> Overdue maintenance
              </span>
              <Badge variant={data.overdueMaintenance > 0 ? "destructive" : "secondary"}>
                {data.overdueMaintenance}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-muted-foreground" /> Recent incidents (7 days)
              </span>
              <Badge variant={data.recentIncidents > 0 ? "destructive" : "secondary"}>
                {data.recentIncidents}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
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
