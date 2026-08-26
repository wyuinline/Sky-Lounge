import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { FleetTable, type FleetRow } from "@/components/portal/fleet/fleet-table";
import { AddUavDialog } from "@/components/portal/fleet/add-uav-dialog";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";

export default async function FleetPage() {
  const supabase = await createClient();
  const [access, { data: uavs }] = await Promise.all([
    getAccess(),
    // The view carries derived total flight hours and hours-until-service, so
    // the fleet page and the reminder scan read the same figures.
    supabase
      .from("uav_fleet_status")
      .select(
        "id, drone_id, registration_number, serial_number, model, manufacturer, weight_kg, purchased_date, location_site, notes, maintenance_interval_hours, status, flight_hours, hours_until_service, next_inspection_date, assigned_pilot_name",
      )
      .order("drone_id")
,
  ]);

  const rows = uavs ?? [];
  const canManageFleet = access?.canManage("fleet") ?? false;

  const active = rows.filter((r) => r.status === "airworthy").length;
  const maintenance = rows.filter((r) => r.status === "maintenance").length;
  const grounded = rows.filter((r) => r.status === "grounded").length;
  // Retired airframes stay in the registry for their history, but counting them
  // as fleet would overstate what the company can actually put in the air.
  const retired = rows.filter((r) => r.status === "retired").length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Asset Registry"
        title="UAV Fleet Management"
        subtitle="Complete registry of all enterprise UAV assets — status, maintenance, and assignment tracking."
        actions={canManageFleet ? <AddUavDialog /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Airworthy" value={`${active}`} tone="good" />
        <MetricTile label="In Maintenance" value={`${maintenance}`} tone="warning" />
        <MetricTile label="Grounded" value={`${grounded}`} tone={grounded > 0 ? "critical" : "good"} />
        <MetricTile label="Retired" value={`${retired}`} tone="neutral" />
      </div>

      <FleetTable rows={rows} />
    </div>
  );
}
