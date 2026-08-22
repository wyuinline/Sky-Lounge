"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/portal/status-dot";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FleetRow = {
  id: string;
  drone_id: string;
  registration_number: string | null;
  serial_number: string | null;
  model: string;
  manufacturer: string | null;
  weight_kg: number | null;
  purchased_date: string | null;
  location_site: string | null;
  notes: string | null;
  maintenance_interval_hours: number | null;
  status: "airworthy" | "maintenance" | "grounded";
  flight_hours: number;
  next_inspection_date: string | null;
  assigned_pilot: { full_name: string | null } | null;
};

const statusTone: Record<FleetRow["status"], "good" | "warning" | "critical"> = {
  airworthy: "good",
  maintenance: "warning",
  grounded: "critical",
};

export function FleetTable({ rows }: { rows: FleetRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

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
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="airworthy">Airworthy</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="grounded">Grounded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No UAVs in the fleet yet." : "No UAVs match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
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
                    <StatusDot tone={statusTone[row.status]} label={row.status} />
                  </TableCell>
                  <TableCell>{row.assigned_pilot?.full_name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.flight_hours}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.maintenance_interval_hours !== null
                      ? `${row.maintenance_interval_hours} h`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
