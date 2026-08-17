import { Plane, Wrench, ShieldAlert } from "lucide-react";
import { PageHero } from "@/components/portal/page-hero";
import { StatCard } from "@/components/portal/stat-card";
import { FleetTable, type FleetRow } from "@/components/portal/fleet/fleet-table";
import { AddUavDialog } from "@/components/portal/fleet/add-uav-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

export default async function FleetPage() {
  const supabase = await createClient();
  const [profile, { data: uavs }] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("uavs")
      .select(
        "id, drone_id, model, manufacturer, status, flight_hours, next_inspection_date, assigned_pilot:assigned_pilot_id(full_name)",
      )
      .order("drone_id")
      .returns<FleetRow[]>(),
  ]);

  const rows = uavs ?? [];
  const canManageFleet = profile
    ? ["uav_admin", "ops_manager", "maintenance_team"].includes(profile.role)
    : false;

  const active = rows.filter((r) => r.status === "active").length;
  const maintenance = rows.filter((r) => r.status === "maintenance").length;
  const grounded = rows.filter((r) => r.status === "grounded").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        title="UAV Fleet Management"
        subtitle="Complete registry of all enterprise UAV assets — status, maintenance, and assignment tracking."
        actions={canManageFleet ? <AddUavDialog /> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active" value={`${active}`} icon={Plane} />
        <StatCard label="In Maintenance" value={`${maintenance}`} icon={Wrench} tone="warning" />
        <StatCard
          label="Grounded"
          value={`${grounded}`}
          icon={ShieldAlert}
          tone={grounded > 0 ? "critical" : "default"}
        />
      </div>

      <FleetTable rows={rows} />
    </div>
  );
}
