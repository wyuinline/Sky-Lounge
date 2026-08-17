"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
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
import { completeMaintenance } from "@/app/(portal)/maintenance/actions";

export type MaintenanceRow = {
  id: string;
  maintenance_type: "preventive" | "repair" | "calibration" | "battery" | "firmware";
  next_service_date: string | null;
  status: "scheduled" | "in_progress" | "overdue" | "completed";
  uavs: { drone_id: string } | null;
  technician: { full_name: string } | null;
};

const statusTone: Record<MaintenanceRow["status"], "neutral" | "critical" | "good"> = {
  scheduled: "neutral",
  in_progress: "neutral",
  overdue: "critical",
  completed: "good",
};

export function MaintenanceTable({ rows, canManage }: { rows: MaintenanceRow[]; canManage: boolean }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleComplete(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await completeMaintenance(id);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Maintenance marked complete — UAV status updated.");
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>UAV ID</TableHead>
            <TableHead>Maintenance Type</TableHead>
            <TableHead>Next Service Date</TableHead>
            <TableHead>Technician</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 6 : 5} className="py-8 text-center text-sm text-muted-foreground">
                No maintenance records yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.uavs?.drone_id ?? "—"}</TableCell>
                <TableCell className="capitalize">{row.maintenance_type}</TableCell>
                <TableCell>{row.next_service_date ?? "—"}</TableCell>
                <TableCell>{row.technician?.full_name ?? "—"}</TableCell>
                <TableCell>
                  <StatusDot tone={statusTone[row.status]} label={row.status.replace("_", " ")} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    {row.status !== "completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending && pendingId === row.id}
                        onClick={() => handleComplete(row.id)}
                      >
                        <CheckCircle2 className="size-4" />
                        Mark Complete
                      </Button>
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
