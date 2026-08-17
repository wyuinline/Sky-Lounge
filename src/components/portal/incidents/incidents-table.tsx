"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusDot } from "@/components/portal/status-dot";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateIncidentStatus } from "@/app/(portal)/incidents/actions";

export type IncidentRow = {
  id: string;
  incident_date: string;
  incident_type: "near_miss" | "crash" | "equipment_failure" | "safety_hazard" | "regulatory_breach";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "closed" | "escalated";
  is_anonymous: boolean;
  uavs: { drone_id: string } | null;
  pilots: { full_name: string } | null;
};

const severityTone: Record<IncidentRow["severity"], "good" | "neutral" | "warning" | "critical"> = {
  low: "good",
  medium: "neutral",
  high: "warning",
  critical: "critical",
};

const statusTone: Record<IncidentRow["status"], "warning" | "neutral" | "good" | "critical"> = {
  open: "warning",
  investigating: "neutral",
  closed: "good",
  escalated: "critical",
};

export function IncidentsTable({ rows, canManage }: { rows: IncidentRow[]; canManage: boolean }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(id: string, status: "investigating" | "closed" | "escalated") {
    setPendingId(id);
    startTransition(async () => {
      const result = await updateIncidentStatus(id, status);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Incident marked as ${status}.`);
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Incident Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>UAV</TableHead>
            <TableHead>Pilot</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                No incidents reported.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.incident_date}</TableCell>
                <TableCell className="capitalize">{row.incident_type.replace("_", " ")}</TableCell>
                <TableCell>{row.uavs?.drone_id ?? "—"}</TableCell>
                <TableCell>{row.is_anonymous ? "Anonymous" : (row.pilots?.full_name ?? "—")}</TableCell>
                <TableCell>
                  <StatusDot tone={severityTone[row.severity]} label={row.severity} />
                </TableCell>
                <TableCell>
                  <StatusDot tone={statusTone[row.status]} label={row.status} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    {row.status === "open" || row.status === "investigating" ? (
                      <div className="flex justify-end gap-2">
                        {row.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending && pendingId === row.id}
                            onClick={() => handleStatusChange(row.id, "investigating")}
                          >
                            Investigate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending && pendingId === row.id}
                          onClick={() => handleStatusChange(row.id, "closed")}
                        >
                          Close
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending && pendingId === row.id}
                          onClick={() => handleStatusChange(row.id, "escalated")}
                        >
                          Escalate
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
