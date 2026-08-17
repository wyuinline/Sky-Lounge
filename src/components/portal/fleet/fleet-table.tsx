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
  model: string;
  manufacturer: string | null;
  status: "active" | "maintenance" | "grounded";
  flight_hours: number;
  next_inspection_date: string | null;
  assigned_pilot: { full_name: string | null } | null;
};

const statusTone: Record<FleetRow["status"], "good" | "warning" | "critical"> = {
  active: "good",
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
        row.drone_id.toLowerCase().includes(search.toLowerCase()) ||
        row.model.toLowerCase().includes(search.toLowerCase()) ||
        (row.manufacturer ?? "").toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by drone ID, model, or manufacturer..."
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
            <SelectItem value="active">Active</SelectItem>
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
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned Pilot</TableHead>
              <TableHead>Flight Hours</TableHead>
              <TableHead>Next Inspection</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No UAVs in the fleet yet." : "No UAVs match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.drone_id}</TableCell>
                  <TableCell>
                    {row.model}
                    {row.manufacturer ? (
                      <span className="text-muted-foreground"> · {row.manufacturer}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusDot tone={statusTone[row.status]} label={row.status} />
                  </TableCell>
                  <TableCell>{row.assigned_pilot?.full_name ?? "Unassigned"}</TableCell>
                  <TableCell>{row.flight_hours}</TableCell>
                  <TableCell>{row.next_inspection_date ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
