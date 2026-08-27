"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/portal/status-dot";
import { OptionSelect } from "@/components/portal/option-select";
import { uavStatusOptions, withAll } from "@/lib/select-options";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FleetRowActions } from "@/components/portal/fleet/fleet-row-actions";
import { AttentionFlag } from "@/components/portal/attention-flag";
import { uavFlags } from "@/lib/flags";

export type FleetRow = {
  id: string | null;
  drone_id: string | null;
  registration_number: string | null;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  weight_kg: number | null;
  purchased_date: string | null;
  location_site: string | null;
  notes: string | null;
  maintenance_interval_hours: number | null;
  baseline_flight_hours: number | null;
  status: 'airworthy' | 'maintenance' | 'grounded' | 'retired' | null;
  flight_hours: number | null;
  hours_until_service: number | null;
  next_inspection_date: string | null;
  assigned_pilot_name: string | null;
};

const statusTone: Record<
  NonNullable<FleetRow["status"]>,
  "good" | "warning" | "critical" | "muted"
> = {
  airworthy: "good",
  maintenance: "warning",
  grounded: "critical",
  // Retired is not a fault, it is an absence — it should not read as an alarm.
  retired: "muted",
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function FleetTable({ rows, canManage }: { rows: FleetRow[]; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchesStatus = status === "all" || row.status === status;
      const matchesSearch =
        search.trim() === "" ||
        [
          row.drone_id,
          row.model,
          row.manufacturer,
          row.registration_number,
          row.serial_number,
          row.location_site,
        ].some((field) => (field ?? "").toLowerCase().includes(search.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by ID, registration, serial, model, or site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <OptionSelect
          value={status}
          onValueChange={setStatus}
          options={withAll(uavStatusOptions, "All statuses")}
          className="sm:w-48"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Drone ID</TableHead>
              <TableHead>Registration</TableHead>
              <TableHead>Make / Model</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead>Location / Site</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned Pilot</TableHead>
              <TableHead className="text-right">Flight Hrs</TableHead>
              <TableHead className="text-right">Interval</TableHead>
              {canManage ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 12 : 11}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0 ? "No UAVs in the fleet yet." : "No UAVs match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="pr-0">
                    <AttentionFlag flags={uavFlags(row, now)} />
                  </TableCell>
                  <TableCell className="font-medium">{row.drone_id}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.registration_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.manufacturer ? `${row.manufacturer} ` : ""}
                    {row.model}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.serial_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.weight_kg !== null ? `${row.weight_kg} kg` : "—"}
                  </TableCell>
                  <TableCell>{row.location_site ?? "—"}</TableCell>
                  <TableCell>
                    {row.status ? (
                      <StatusDot tone={statusTone[row.status]} label={row.status} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{row.assigned_pilot_name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.flight_hours !== null ? round1(row.flight_hours) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.maintenance_interval_hours !== null ? (
                      <>
                        {row.maintenance_interval_hours} h
                        {row.hours_until_service !== null ? (
                          <span
                            className={
                              row.hours_until_service <= 0
                                ? "block text-xs text-[var(--status-critical)]"
                                : "block text-xs text-muted-foreground"
                            }
                          >
                            {row.hours_until_service <= 0
                              ? "service due"
                              : `${round1(row.hours_until_service)} h left`}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <FleetRowActions
                        uav={{
                          id: row.id ?? "",
                          drone_id: row.drone_id,
                          model: row.model,
                          manufacturer: row.manufacturer,
                          registration_number: row.registration_number,
                          serial_number: row.serial_number,
                          weight_kg: row.weight_kg,
                          purchased_date: row.purchased_date,
                          location_site: row.location_site,
                          maintenance_interval_hours: row.maintenance_interval_hours,
                          next_inspection_date: row.next_inspection_date,
                          notes: row.notes,
                          status: row.status,
                          baseline_flight_hours: row.baseline_flight_hours,
                        }}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
