import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { MaintenanceTable } from "@/components/portal/maintenance/maintenance-table";
import { AirframeHoursTable } from "@/components/portal/maintenance/hours-table";
import { SectionLabel } from "@/components/portal/section-label";
import { LogMaintenanceDialog } from "@/components/portal/maintenance/log-maintenance-dialog";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { isMaintenanceOverdue } from "@/lib/compliance";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const [access, recordsRes, uavsRes, profilesRes, hoursRes] = await Promise.all([
    getAccess(),
    supabase
      .from("maintenance_records")
      .select(
        "id, maintenance_type, next_service_date, status, completed_date, created_at, uavs(drone_id), technician:technician_id(full_name)",
      )
      .order("next_service_date")
,
    // Retired airframes likewise — they are kept for their logs, not to fly.
    supabase.from("uavs").select("id, drone_id").neq("status", "retired").order("drone_id"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("uav_fleet_status")
      .select("uav_id, drone_id, maintenance_interval_hours, hours_since_service, hours_until_service")
      .not("maintenance_interval_hours", "is", null)
      .order("hours_until_service"),
  ]);

  const records = recordsRes.data ?? [];
  const uavOptions = (uavsRes.data ?? []).map((u) => ({ id: u.id, label: u.drone_id }));
  const technicianOptions = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? "Unnamed",
  }));
  const canManage = access?.canManage("maintenance") ?? false;

  const now = new Date();
  const scheduledThisMonth = records.filter(
    (r) =>
      r.status === "scheduled" &&
      r.next_service_date &&
      new Date(r.next_service_date).getFullYear() === now.getFullYear() &&
      new Date(r.next_service_date).getMonth() === now.getMonth(),
  ).length;
  // Derived from the service date — the stored status is never advanced to
  // 'overdue', so filtering on it always returned zero.
  const overdue = records.filter((r) => isMaintenanceOverdue(r, now)).length;
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
      <HeroBand
        eyebrow="Service Records"
        title="UAV Maintenance Management"
        subtitle="Preventive maintenance, repair tracking, parts replacement, and calibration records."
        actions={canManage ? <LogMaintenanceDialog uavs={uavOptions} technicians={technicianOptions} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Scheduled This Month" value={`${scheduledThisMonth}`} tone="neutral" />
        <MetricTile label="Overdue" value={`${overdue}`} tone={overdue > 0 ? "critical" : "good"} />
        <MetricTile label="Completed (YTD)" value={`${completedYtd.length}`} tone="good" />
        <MetricTile
          label="Avg. Turnaround Time"
          value={avgTurnaround !== null ? `${avgTurnaround} days` : "—"}
          tone="neutral"
        />
      </div>

      <div>
        <SectionLabel>Service Interval by Airframe</SectionLabel>
        <AirframeHoursTable rows={hoursRes.data ?? []} />
      </div>

      <div>
        <SectionLabel>Maintenance Records</SectionLabel>
        <MaintenanceTable rows={records} canManage={canManage} />
      </div>
    </div>
  );
}
