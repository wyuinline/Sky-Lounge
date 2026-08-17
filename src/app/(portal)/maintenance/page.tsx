import { Wrench, AlertTriangle, CheckCircle2, Timer } from "lucide-react";
import { PageHero } from "@/components/portal/page-hero";
import { StatCard } from "@/components/portal/stat-card";
import { MaintenanceTable, type MaintenanceRow } from "@/components/portal/maintenance/maintenance-table";
import { LogMaintenanceDialog } from "@/components/portal/maintenance/log-maintenance-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

type FullMaintenanceRow = MaintenanceRow & {
  completed_date: string | null;
  created_at: string;
};

export default async function MaintenancePage() {
  const supabase = await createClient();
  const [profile, recordsRes, uavsRes, profilesRes] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("maintenance_records")
      .select(
        "id, maintenance_type, next_service_date, status, completed_date, created_at, uavs(drone_id), technician:technician_id(full_name)",
      )
      .order("next_service_date")
      .returns<FullMaintenanceRow[]>(),
    supabase.from("uavs").select("id, drone_id").order("drone_id"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const records = recordsRes.data ?? [];
  const uavOptions = (uavsRes.data ?? []).map((u) => ({ id: u.id, label: u.drone_id }));
  const technicianOptions = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? "Unnamed",
  }));
  const canManage = profile ? ["uav_admin", "maintenance_team"].includes(profile.role) : false;

  const now = new Date();
  const scheduledThisMonth = records.filter(
    (r) =>
      r.status === "scheduled" &&
      r.next_service_date &&
      new Date(r.next_service_date).getFullYear() === now.getFullYear() &&
      new Date(r.next_service_date).getMonth() === now.getMonth(),
  ).length;
  const overdue = records.filter((r) => r.status === "overdue").length;
  const completedYtd = records.filter(
    (r) => r.status === "completed" && r.completed_date && new Date(r.completed_date).getFullYear() === now.getFullYear(),
  );
  const turnaroundDays = completedYtd
    .filter((r) => r.completed_date)
    .map((r) => (new Date(r.completed_date!).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const avgTurnaround =
    turnaroundDays.length > 0
      ? Math.round((turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length) * 10) / 10
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        title="UAV Maintenance Management"
        subtitle="Preventive maintenance, repair tracking, parts replacement, and calibration records."
        actions={canManage ? <LogMaintenanceDialog uavs={uavOptions} technicians={technicianOptions} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Scheduled This Month" value={`${scheduledThisMonth}`} icon={Wrench} />
        <StatCard
          label="Overdue"
          value={`${overdue}`}
          icon={AlertTriangle}
          tone={overdue > 0 ? "critical" : "default"}
        />
        <StatCard label="Completed (YTD)" value={`${completedYtd.length}`} icon={CheckCircle2} />
        <StatCard
          label="Avg. Turnaround Time"
          value={avgTurnaround !== null ? `${avgTurnaround} days` : "—"}
          icon={Timer}
        />
      </div>

      <MaintenanceTable rows={records} canManage={canManage} />
    </div>
  );
}
