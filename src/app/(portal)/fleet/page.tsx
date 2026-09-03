import { HeroBand } from "@/components/portal/hero-band";
import { SectionLabel } from "@/components/portal/section-label";
import { MetricTile } from "@/components/portal/metric-tile";
import { FleetTable } from "@/components/portal/fleet/fleet-table";
import { AddUavDialog } from "@/components/portal/fleet/uav-dialog";
import { BatteriesTable, type BatteryRow } from "@/components/portal/fleet/batteries-table";
import { AddBatteryDialog } from "@/components/portal/fleet/battery-dialog";
import {
  ComponentsTable,
  AddComponentDialog,
  type ComponentRow,
} from "@/components/portal/fleet/components-table";
import { ImportDialog } from "@/components/portal/import-dialog";
import { uavImport, batteryImport, componentImport } from "@/lib/import-schemas";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { AttentionSummary } from "@/components/portal/attention-flag";
import { uavFlags, batteryFlags, componentFlags, worstSeverity } from "@/lib/flags";

export default async function FleetPage() {
  const supabase = await createClient();
  const [access, { data: uavs }, { data: batteries }, { data: parts }] = await Promise.all([
    getAccess(),
    // The view carries derived total flight hours and hours-until-service, so
    // the fleet page and the reminder scan read the same figures.
    supabase
      .from("uav_fleet_status")
      .select(
        "id, drone_id, registration_number, serial_number, model, manufacturer, weight_kg, purchased_date, location_site, notes, maintenance_interval_hours, baseline_flight_hours, status, flight_hours, hours_until_service, next_inspection_date, assigned_pilot_name",
      )
      .order("drone_id")
,
    // Packs carry derived cycles and remaining life, the same way airframes
    // carry derived hours.
    supabase
      .from("battery_status_view")
      .select(
        "id, battery_id, model, manufacturer, serial_number, capacity_mah, cell_count, purchased_date, baseline_cycles, cycle_limit, status, location_site, notes, total_cycles, cycles_remaining, last_used_on, age_months",
      )
      .order("battery_id"),
    // Component hours are derived from the airframes they were fitted to, for
    // the periods they were fitted.
    supabase
      .from("component_status_view")
      .select(
        "id, component_id, category, name, manufacturer, model, serial_number, purchased_date, baseline_hours, service_interval_hours, status, location_site, notes, total_hours, hours_until_service, fitted_to_uav_id, fitted_to, fitted_on",
      )
      .order("component_id"),
  ]);

  const rows = uavs ?? [];
  const canManageFleet = access?.canManage("fleet") ?? false;

  const active = rows.filter((r) => r.status === "airworthy").length;
  const maintenance = rows.filter((r) => r.status === "maintenance").length;
  const grounded = rows.filter((r) => r.status === "grounded").length;
  // Retired airframes stay in the registry for their history, but counting them
  // as fleet would overstate what the company can actually put in the air.
  const retired = rows.filter((r) => r.status === "retired").length;

  const packs: BatteryRow[] = (batteries ?? []).map((b) => ({
    id: b.id ?? "",
    battery_id: b.battery_id,
    model: b.model,
    manufacturer: b.manufacturer,
    serial_number: b.serial_number,
    capacity_mah: b.capacity_mah,
    cell_count: b.cell_count,
    purchased_date: b.purchased_date,
    baseline_cycles: b.baseline_cycles,
    cycle_limit: b.cycle_limit,
    status: b.status,
    location_site: b.location_site,
    notes: b.notes,
    total_cycles: b.total_cycles,
    cycles_remaining: b.cycles_remaining,
    last_used_on: b.last_used_on,
    age_months: b.age_months,
  }));

  const components: ComponentRow[] = (parts ?? []).map((c) => ({
    id: c.id ?? "",
    component_id: c.component_id,
    category: c.category,
    name: c.name,
    manufacturer: c.manufacturer,
    model: c.model,
    serial_number: c.serial_number,
    purchased_date: c.purchased_date,
    baseline_hours: c.baseline_hours,
    service_interval_hours: c.service_interval_hours,
    status: c.status,
    location_site: c.location_site,
    notes: c.notes,
    total_hours: c.total_hours,
    hours_until_service: c.hours_until_service,
    fitted_to_uav_id: c.fitted_to_uav_id,
    fitted_to: c.fitted_to,
    fitted_on: c.fitted_on,
  }));

  const servicePacks = packs.filter((p) => p.status !== "retired").length;
  const liveParts = components.filter((c) => c.status !== "retired").length;

  // Airframes that can still be fitted with parts.
  const fitTargets = rows
    .filter((r) => r.status !== "retired")
    .map((r) => ({ id: r.id ?? "", label: r.drone_id ?? "Unnamed airframe" }));

  // Airframes and packs share one attention summary: they are one fleet, and
  // splitting the count would hide a grounded aircraft behind a healthy row of
  // batteries.
  const flagged = [
    ...rows.map((r) => worstSeverity(uavFlags(r))),
    ...packs.map((p) =>
      worstSeverity(
        batteryFlags({
          status: p.status ?? "serviceable",
          cycles_remaining: p.cycles_remaining,
          age_months: p.age_months,
        }),
      ),
    ),
    ...components.map((c) =>
      worstSeverity(
        componentFlags({
          status: c.status ?? "spare",
          hours_until_service: c.hours_until_service,
          fitted_to: c.fitted_to,
        }),
      ),
    ),
  ];
  const overdueCount = flagged.filter((s) => s === "overdue").length;
  const attentionCount = flagged.filter((s) => s === "attention").length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Asset Registry"
        title="UAV Fleet Management"
        subtitle="Complete registry of all enterprise UAV assets — status, maintenance, and assignment tracking."
        actions={
          canManageFleet ? (
            <>
              <AddUavDialog />
              <ImportDialog
                schema={uavImport}
                canManage={canManageFleet}
                buttonLabel="Import aircraft"
              />
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Airworthy" value={`${active}`} tone="good" />
        <MetricTile label="In Maintenance" value={`${maintenance}`} tone="warning" />
        <MetricTile label="Grounded" value={`${grounded}`} tone={grounded > 0 ? "critical" : "good"} />
        <MetricTile label="Retired" value={`${retired}`} tone="neutral" />
        <MetricTile label="Batteries" value={`${servicePacks}`} tone="neutral" />
        <MetricTile label="Parts" value={`${liveParts}`} tone="neutral" />
      </div>

      <AttentionSummary overdue={overdueCount} attention={attentionCount} noun="fleet" />

      <div>
        <SectionLabel>Airframes</SectionLabel>
        <FleetTable rows={rows} canManage={canManageFleet} />
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 pb-1">
          <SectionLabel>Batteries</SectionLabel>
          <span className="flex gap-2">
            <ImportDialog schema={batteryImport} canManage={canManageFleet} />
            {canManageFleet ? <AddBatteryDialog /> : null}
          </span>
        </div>
        <BatteriesTable rows={packs} canManage={canManageFleet} />
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 pb-1">
          <SectionLabel>Parts &amp; Equipment</SectionLabel>
          <span className="flex gap-2">
            <ImportDialog schema={componentImport} canManage={canManageFleet} />
            {canManageFleet ? <AddComponentDialog /> : null}
          </span>
        </div>
        <ComponentsTable rows={components} uavs={fitTargets} canManage={canManageFleet} />
      </div>
    </div>
  );
}
