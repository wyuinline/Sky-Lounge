"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Upload, Waypoints, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import { TrackPlot, type TrackPoint } from "@/components/portal/flights/track-plot";
import { importTelemetry, clearTelemetry } from "@/app/(portal)/flights/telemetry-actions";

export type FlightTelemetry = {
  source: string | null;
  importedAt: string | null;
  sampleCount: number | null;
  maxSpeed: number | null;
  maxDistance: number | null;
  trackLength: number | null;
  batteryStart: number | null;
  batteryEnd: number | null;
  minVoltage: number | null;
  minSatellites: number | null;
  track: TrackPoint[] | null;
};

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.65rem] font-semibold tracking-[0.06em] text-brand-teal uppercase">
        {label}
      </dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}

export function TelemetryDialog({
  flightId,
  flightLabel,
  telemetry,
  canManage,
  open,
  onOpenChange,
}: {
  flightId: string;
  flightLabel: string;
  telemetry: FlightTelemetry | null;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isPending, startTransition] = useTransition();

  const imported = telemetry !== null && telemetry.importedAt !== null;

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = event.currentTarget;
    const result = await importTelemetry(flightId, new FormData(form));
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      // Naming the columns it could not place turns "that did not work" into
      // something the person can act on.
      if (result.unmatched && result.unmatched.length > 0) {
        toast.info(`Columns not recognised: ${result.unmatched.slice(0, 8).join(", ")}`);
      }
      return;
    }

    toast.success(
      `Imported ${result.summary?.sampleCount.toLocaleString()} samples${
        result.trackPoints ? `, ${result.trackPoints} track points` : ""
      }.`,
    );
    form.reset();
  }

  const n = (v: number | null, unit: string, dp = 0) =>
    v === null ? "—" : `${v.toFixed(dp)} ${unit}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Telemetry — {flightLabel}</DialogTitle>
            <DialogDescription>
              Import the flight log as CSV. Columns are recognised by name, so exports from DJI log
              viewers, ArduPilot and PX4 all work without conversion.
            </DialogDescription>
          </DialogHeader>

          {imported ? (
            <div className="flex flex-col gap-4">
              {telemetry.track && telemetry.track.length > 1 ? (
                <TrackPlot track={telemetry.track} />
              ) : (
                <p className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  No positions in this import — the file carried altitude but no fixes.
                </p>
              )}

              <dl className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 sm:grid-cols-4">
                <Figure label="Samples" value={telemetry.sampleCount?.toLocaleString() ?? "—"} />
                <Figure label="Max speed" value={n(telemetry.maxSpeed, "m/s", 1)} />
                <Figure label="Max distance" value={n(telemetry.maxDistance, "m")} />
                <Figure label="Track length" value={n(telemetry.trackLength, "m")} />
                <Figure
                  label="Battery"
                  value={
                    telemetry.batteryStart === null
                      ? "—"
                      : `${telemetry.batteryStart}% → ${telemetry.batteryEnd ?? "?"}%`
                  }
                />
                <Figure label="Min voltage" value={n(telemetry.minVoltage, "V", 2)} />
                <Figure
                  label="Min satellites"
                  value={telemetry.minSatellites === null ? "—" : String(telemetry.minSatellites)}
                />
                <Figure label="Source" value={telemetry.source ?? "—"} />
              </dl>

              {canManage ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Imported {telemetry.importedAt?.slice(0, 16).replace("T", " ")}. Importing again
                    replaces this.
                  </p>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmClear(true)}>
                    <Trash2 className="size-4" />
                    Remove import
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {canManage ? (
            <form onSubmit={handleUpload} className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="telemetry_file">
                  {imported ? "Replace with another file" : "Telemetry CSV"}
                </Label>
                <Input id="telemetry_file" name="file" type="file" accept=".csv,text/csv" required />
                <p className="text-xs text-muted-foreground">
                  Needs latitude and longitude, or a height column. Time, speed, battery, voltage
                  and satellites are read when present.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  <Upload className="size-4" />
                  {loading ? "Importing..." : "Import telemetry"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Remove this telemetry import?"
        description={
          <>
            The track, the summary figures and the stored file are deleted. The flight log itself —
            date, crew, aircraft, duration — is untouched.
          </>
        }
        confirmLabel="Remove import"
        destructive
        pending={isPending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await clearTelemetry(flightId);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            setConfirmClear(false);
            onOpenChange(false);
            toast.success("Telemetry removed.");
          })
        }
      />
    </>
  );
}

/** The button that opens the dialog, for a row in the logs table. */
export function TelemetryButton({
  flightId,
  flightLabel,
  telemetry,
  canManage,
}: {
  flightId: string;
  flightLabel: string;
  telemetry: FlightTelemetry | null;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const imported = telemetry !== null && telemetry.importedAt !== null;

  return (
    <>
      <Button
        size="sm"
        variant={imported ? "outline" : "ghost"}
        onClick={() => setOpen(true)}
        aria-label={
          imported ? `View telemetry for ${flightLabel}` : `Import telemetry for ${flightLabel}`
        }
      >
        <Waypoints className="size-3.5" />
        {imported ? "Track" : "Import"}
      </Button>
      <TelemetryDialog
        flightId={flightId}
        flightLabel={flightLabel}
        telemetry={telemetry}
        canManage={canManage}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
