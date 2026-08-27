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
import { TelemetryButton } from "@/components/portal/flights/telemetry-dialog";
import type { TrackPoint } from "@/components/portal/flights/track-plot";
import { acknowledgeFlightLog } from "@/app/(portal)/flights/actions";

export type FlightLogRow = {
  id: string;
  flight_date: string;
  /** Derived by the database from takeoff and landing when both are recorded. */
  effective_duration_minutes: number | null;
  weather_conditions: string | null;
  mission_outcome: "completed" | "aborted" | "partial";
  acknowledged_at: string | null;
  takeoff_at: string | null;
  landing_at: string | null;
  location_name: string | null;
  airspace: "uncontrolled" | "controlled" | "restricted" | "advisory" | null;
  is_night: boolean;
  is_bvlos: boolean;
  is_over_people: boolean;
  is_sheltered: boolean;
  sfoc_reference: string | null;
  telemetry_source: string | null;
  telemetry_imported_at: string | null;
  telemetry_sample_count: number | null;
  telemetry_max_speed_ms: number | null;
  telemetry_max_distance_m: number | null;
  telemetry_track_length_m: number | null;
  battery_start_percent: number | null;
  battery_end_percent: number | null;
  min_voltage: number | null;
  min_satellites: number | null;
  cell_count: number | null;
  max_cell_spread: number | null;
  min_cell_voltage: number | null;
  telemetry_track: TrackPoint[] | null;
  pilots: { full_name: string } | null;
  uavs: { drone_id: string } | null;
};

/**
 * The operational categories worth seeing without opening the row — these are
 * what decide which rules a flight was under.
 */
const categoryChips: { key: keyof FlightLogRow; label: string; title: string }[] = [
  { key: "is_night", label: "NIGHT", title: "Night operation" },
  { key: "is_bvlos", label: "BVLOS", title: "Beyond visual line of sight" },
  { key: "is_over_people", label: "OVER PPL", title: "Over people" },
  { key: "is_sheltered", label: "SHELT", title: "Sheltered operation" },
];

const airspaceShort: Record<string, string> = {
  uncontrolled: "Class G",
  controlled: "Controlled",
  restricted: "Restricted",
  advisory: "Advisory",
};

/** "14:05" from a timestamp, in the reader's own timezone. */
function clock(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
            <TableHead>Site</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Airspace</TableHead>
            <TableHead>Operation</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="text-right">Telemetry</TableHead>
            {canAcknowledge && <TableHead className="text-right">Reviewed</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canAcknowledge ? 11 : 10}
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
                <TableCell className="font-medium">
                  {row.flight_date}
                  {clock(row.takeoff_at) ? (
                    <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                      {clock(row.takeoff_at)}
                      {clock(row.landing_at) ? ` – ${clock(row.landing_at)}` : ""}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{row.pilots?.full_name ?? "—"}</TableCell>
                <TableCell>{row.uavs?.drone_id ?? "—"}</TableCell>
                <TableCell className="max-w-40 truncate">
                  {row.location_name ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.effective_duration_minutes !== null
                    ? `${row.effective_duration_minutes} min`
                    : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.airspace ? (
                    airspaceShort[row.airspace]
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {categoryChips.filter((c) => row[c.key] === true).length === 0 ? (
                      <span className="text-sm text-muted-foreground">Standard</span>
                    ) : (
                      categoryChips
                        .filter((c) => row[c.key] === true)
                        .map((c) => (
                          <span
                            key={c.label}
                            title={c.title}
                            className="rounded-sm border border-brand-teal/40 bg-brand-teal/10 px-1 py-0.5 text-[0.6rem] font-semibold tracking-wide text-brand-teal"
                          >
                            {c.label}
                          </span>
                        ))
                    )}
                    {row.sfoc_reference ? (
                      <span
                        title={`SFOC ${row.sfoc_reference}`}
                        className="rounded-sm border border-[var(--status-warning)]/50 bg-[var(--status-warning)]/10 px-1 py-0.5 text-[0.6rem] font-semibold tracking-wide text-[var(--status-warning)]"
                      >
                        SFOC
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusDot tone={outcomeTone[row.mission_outcome]} label={row.mission_outcome} />
                </TableCell>
                <TableCell className="text-right">
                  <TelemetryButton
                    flightId={row.id}
                    flightLabel={`${row.flight_date} · ${row.uavs?.drone_id ?? "flight"}`}
                    canManage={canAcknowledge}
                    telemetry={{
                      source: row.telemetry_source,
                      importedAt: row.telemetry_imported_at,
                      sampleCount: row.telemetry_sample_count,
                      maxSpeed: row.telemetry_max_speed_ms,
                      maxDistance: row.telemetry_max_distance_m,
                      trackLength: row.telemetry_track_length_m,
                      batteryStart: row.battery_start_percent,
                      batteryEnd: row.battery_end_percent,
                      minVoltage: row.min_voltage,
                      minSatellites: row.min_satellites,
                      cellCount: row.cell_count,
                      maxCellSpread: row.max_cell_spread,
                      minCellVoltage: row.min_cell_voltage,
                      track: row.telemetry_track,
                    }}
                  />
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
