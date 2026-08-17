"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
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
import { updateFlightRequestStatus } from "@/app/(portal)/flights/actions";

export type FlightRequestRow = {
  id: string;
  location: string | null;
  requested_date: string;
  risk_level: "low" | "medium" | "high" | "critical";
  approval_status: "pending" | "approved" | "rejected";
  pilots: { full_name: string } | null;
  uavs: { drone_id: string } | null;
};

const riskTone: Record<FlightRequestRow["risk_level"], "good" | "neutral" | "warning" | "critical"> = {
  low: "good",
  medium: "neutral",
  high: "warning",
  critical: "critical",
};

const approvalTone: Record<FlightRequestRow["approval_status"], "good" | "neutral" | "critical"> = {
  pending: "neutral",
  approved: "good",
  rejected: "critical",
};

export function FlightRequestsTable({
  rows,
  canApprove,
}: {
  rows: FlightRequestRow[];
  canApprove: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDecision(id: string, status: "approved" | "rejected") {
    setPendingId(id);
    startTransition(async () => {
      const result = await updateFlightRequestStatus(id, status);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "approved" ? "Flight request approved." : "Flight request rejected.");
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pilot</TableHead>
            <TableHead>UAV</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Requested Date</TableHead>
            <TableHead>Risk Level</TableHead>
            <TableHead>Status</TableHead>
            {canApprove && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canApprove ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                No flight requests yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.pilots?.full_name ?? "—"}</TableCell>
                <TableCell>{row.uavs?.drone_id ?? "—"}</TableCell>
                <TableCell>{row.location ?? "—"}</TableCell>
                <TableCell>{row.requested_date}</TableCell>
                <TableCell>
                  <StatusDot tone={riskTone[row.risk_level]} label={row.risk_level} />
                </TableCell>
                <TableCell>
                  <StatusDot tone={approvalTone[row.approval_status]} label={row.approval_status} />
                </TableCell>
                {canApprove && (
                  <TableCell className="text-right">
                    {row.approval_status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending && pendingId === row.id}
                          onClick={() => handleDecision(row.id, "approved")}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending && pendingId === row.id}
                          onClick={() => handleDecision(row.id, "rejected")}
                        >
                          <X className="size-4" />
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
