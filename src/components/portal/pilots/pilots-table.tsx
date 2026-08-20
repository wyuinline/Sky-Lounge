"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/portal/status-dot";
import { deriveExpiryStatus, expiryStatusLabel, expiryStatusTone } from "@/lib/compliance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PilotRow = {
  id: string;
  full_name: string;
  employee_id: string | null;
  license_number: string | null;
  medical_expiry: string | null;
  flight_hours: number;
  currency_status: "current" | "due_soon" | "expired";
  training_records: { id: string }[];
};

const currencyTone: Record<PilotRow["currency_status"], "good" | "warning" | "critical"> = {
  current: "good",
  due_soon: "warning",
  expired: "critical",
};

const currencyLabel: Record<PilotRow["currency_status"], string> = {
  current: "Current",
  due_soon: "Due Soon",
  expired: "Expired",
};

export function PilotsTable({ rows }: { rows: PilotRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (search.trim() === "") return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (row) =>
        row.full_name.toLowerCase().includes(q) ||
        (row.employee_id ?? "").toLowerCase().includes(q) ||
        (row.license_number ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search by name, employee ID, or license number..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-xs"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pilot Name</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>License Number</TableHead>
              <TableHead>Certifications</TableHead>
              <TableHead>Medical Expiry</TableHead>
              <TableHead>Flight Hours</TableHead>
              <TableHead>Currency Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No pilots in the registry yet." : "No pilots match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.full_name}</TableCell>
                  <TableCell>{row.employee_id ?? "—"}</TableCell>
                  <TableCell>{row.license_number ?? "—"}</TableCell>
                  <TableCell>{row.training_records.length}</TableCell>
                  <TableCell>{row.medical_expiry ?? "—"}</TableCell>
                  <TableCell>{row.flight_hours}</TableCell>
                  <TableCell>
                    {(() => {
                      // Derived from the medical expiry rather than the stored
                      // currency_status column, which nothing keeps in sync.
                      const derived = deriveExpiryStatus(row.medical_expiry);
                      return (
                        <StatusDot
                          tone={expiryStatusTone[derived]}
                          label={expiryStatusLabel[derived]}
                        />
                      );
                    })()}
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
