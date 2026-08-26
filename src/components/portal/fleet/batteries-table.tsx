"use client";

import { useMemo, useState, useTransition } from "react";
import { MoreHorizontal, Pencil, BatteryCharging, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/portal/status-dot";
import { AttentionFlag } from "@/components/portal/attention-flag";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { batteryFlags } from "@/lib/flags";
import {
  EditBatteryDialog,
  batteryStatusLabel,
  type BatteryFormValues,
  type BatteryStatus,
} from "@/components/portal/fleet/battery-dialog";
import { deleteBattery, setBatteryStatus } from "@/app/(portal)/fleet/battery-actions";

export type BatteryRow = BatteryFormValues & {
  total_cycles: number | null;
  cycles_remaining: number | null;
  last_used_on: string | null;
  age_months: number | null;
};

const statusTone: Record<BatteryStatus, "good" | "warning" | "muted"> = {
  serviceable: "good",
  monitor: "warning",
  retired: "muted",
};

function RowActions({ battery }: { battery: BatteryRow }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"retire" | "restore" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();
  const name = battery.battery_id ?? "this pack";
  const retired = battery.status === "retired";

  function run(work: () => Promise<{ error: string | null }>, success: string) {
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setConfirming(null);
      toast.success(success);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button size="icon" variant="ghost" aria-label={`Actions for ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit details
          </DropdownMenuItem>
          {retired ? (
            <DropdownMenuItem onClick={() => setConfirming("restore")}>
              <BatteryCharging className="size-4" />
              Return to service
            </DropdownMenuItem>
          ) : (
            <>
              {battery.status !== "monitor" ? (
                <DropdownMenuItem
                  onClick={() => run(() => setBatteryStatus(battery.id, "monitor"), `${name} marked for monitoring.`)}
                >
                  <Eye className="size-4" />
                  Mark for monitoring
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => setConfirming("retire")}>
                <BatteryCharging className="size-4" />
                Retire pack
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
            <Trash2 className="size-4" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditBatteryDialog battery={battery} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        open={confirming === "retire"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Retire ${name}?`}
        description={
          <>
            It stops appearing when logging a flight and drops out of the serviceable count. Every
            cycle it has flown is kept as part of the maintenance record.
          </>
        }
        confirmLabel="Retire pack"
        pending={isPending}
        onConfirm={() => run(() => setBatteryStatus(battery.id, "retired"), `${name} retired.`)}
      />

      <ConfirmDialog
        open={confirming === "restore"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Return ${name} to service?`}
        description={<>Check it for swelling and confirm its capacity before it goes back on an aircraft.</>}
        confirmLabel="Return to service"
        pending={isPending}
        onConfirm={() => run(() => setBatteryStatus(battery.id, "serviceable"), `${name} back in service.`)}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Delete ${name} permanently?`}
        description={
          <>
            This cannot be undone, and only works while no flight references the pack. Anything that
            has flown must be retired instead — its cycles are part of the service history.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        pending={isPending}
        onConfirm={() => run(() => deleteBattery(battery.id), `${name} deleted.`)}
      />
    </>
  );
}

export function BatteriesTable({
  rows,
  canManage,
}: {
  rows: BatteryRow[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);

  const retiredCount = rows.filter((r) => r.status === "retired").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!showRetired && row.status === "retired") return false;
      if (q === "") return true;
      return [row.battery_id, row.model, row.manufacturer, row.serial_number, row.location_site].some(
        (f) => (f ?? "").toLowerCase().includes(q),
      );
    });
  }, [rows, search, showRetired]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by ID, serial, model, or site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        {retiredCount > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(e) => setShowRetired(e.target.checked)}
              className="size-4 accent-[var(--brand-teal)]"
            />
            Show retired ({retiredCount})
          </label>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Battery ID</TableHead>
              <TableHead>Make / Model</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead className="text-right">Cycles</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 10 : 9}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? "No batteries recorded yet. Add the packs you fly so their cycles are tracked."
                    : "No batteries match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className={row.status === "retired" ? "opacity-60" : undefined}>
                  <TableCell className="pr-0">
                    <AttentionFlag
                      flags={batteryFlags({
                        status: row.status ?? "serviceable",
                        cycles_remaining: row.cycles_remaining,
                        age_months: row.age_months,
                      })}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{row.battery_id}</TableCell>
                  <TableCell>
                    {row.manufacturer ? `${row.manufacturer} ` : ""}
                    {row.model ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.serial_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.total_cycles ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.cycles_remaining !== null ? (
                      <span
                        className={
                          row.cycles_remaining <= 0
                            ? "text-[var(--status-critical)]"
                            : undefined
                        }
                      >
                        {row.cycles_remaining}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">no limit set</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{row.last_used_on ?? "—"}</TableCell>
                  <TableCell>{row.location_site ?? "—"}</TableCell>
                  <TableCell>
                    {row.status ? (
                      <StatusDot
                        tone={statusTone[row.status]}
                        label={batteryStatusLabel[row.status]}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <RowActions battery={row} />
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
