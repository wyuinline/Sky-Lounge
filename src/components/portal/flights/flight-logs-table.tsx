"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { StatusDot } from "@/components/portal/status-dot";
import { AttentionFlag } from "@/components/portal/attention-flag";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { flightLogFlags } from "@/lib/flags";
import { acknowledgeFlightLog } from "@/app/(portal)/flights/actions";

export type FlightLogRow = {
  id: string;
  flight_date: string;
  duration_minutes: number | null;
  weather_conditions: string | null;
  mission_outcome: "completed" | "aborted" | "partial";
  acknowledged_at: string | null;
  pilots: { full_name: string } | null;
  uavs: { drone_id: string } | null;
};

const outcomeTone: Record<FlightLogRow["mission_outcome"], "good" | "warning" | "critical"> = {
  completed: "good",
  partial: "warning",
  aborted: "critical",
};

export function FlightLogsTable({
  rows,
  canAcknowledge,
}: {
  rows: FlightLogRow[];
  /** Whether this person can clear the "newly filed" flag. */
  canAcknowledge: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function acknowledge(row: FlightLogRow) {
    setPendingId(row.id);
    startTransition(async () => {
      const result = await acknowledgeFlightLog(row.id);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Log marked as reviewed.");
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Flight Date</TableHead>
            <TableHead>Pilot</TableHead>
            <TableHead>UAV</TableHead>
            <TableHead>Duration (min)</TableHead>
            <TableHead>Weather</TableHead>
            <TableHead>Outcome</TableHead>
            {canAcknowledge && <TableHead className="text-right">Reviewed</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canAcknowledge ? 8 : 7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No flight logs yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pr-0">
                  <AttentionFlag flags={flightLogFlags(row)} />
                </TableCell>
                <TableCell className="font-medium">{row.flight_date}</TableCell>
                <TableCell>{row.pilots?.full_name ?? "—"}</TableCell>
                <TableCell>{row.uavs?.drone_id ?? "—"}</TableCell>
                <TableCell>{row.duration_minutes ?? "—"}</TableCell>
                <TableCell>{row.weather_conditions ?? "—"}</TableCell>
                <TableCell>
                  <StatusDot tone={outcomeTone[row.mission_outcome]} label={row.mission_outcome} />
                </TableCell>
                {canAcknowledge && (
                  <TableCell className="text-right">
                    {row.acknowledged_at ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {row.acknowledged_at.slice(0, 10)}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === row.id}
                        onClick={() => acknowledge(row)}
                      >
                        <Eye className="size-3.5" />
                        {pendingId === row.id ? "Saving..." : "Mark seen"}
                      </Button>
                    )}
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
