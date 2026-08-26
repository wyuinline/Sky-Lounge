"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { MoreHorizontal, Pencil, Wrench, Plus, PlugZap, Unplug, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusDot } from "@/components/portal/status-dot";
import { AttentionFlag } from "@/components/portal/attention-flag";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { componentFlags } from "@/lib/flags";
import {
  addComponent,
  updateComponent,
  installComponent,
  removeComponent,
  setComponentStatus,
  deleteComponent,
} from "@/app/(portal)/fleet/component-actions";

export type ComponentCategory =
  | "motor" | "propeller" | "esc" | "gimbal" | "camera" | "payload"
  | "rtk_base" | "controller" | "antenna" | "charger" | "case" | "other";

export type ComponentStatus = "in_service" | "spare" | "maintenance" | "retired";

export const categoryLabel: Record<ComponentCategory, string> = {
  motor: "Motor",
  propeller: "Propeller",
  esc: "ESC",
  gimbal: "Gimbal",
  camera: "Camera",
  payload: "Payload",
  rtk_base: "RTK base",
  controller: "Controller",
  antenna: "Antenna",
  charger: "Charger",
  case: "Case",
  other: "Other",
};

export const componentStatusLabel: Record<ComponentStatus, string> = {
  in_service: "In service",
  spare: "Spare",
  maintenance: "Maintenance",
  retired: "Retired",
};

const statusTone: Record<ComponentStatus, "good" | "neutral" | "warning" | "muted"> = {
  in_service: "good",
  spare: "neutral",
  maintenance: "warning",
  retired: "muted",
};

export type UavOption = { id: string; label: string };

export type ComponentRow = {
  id: string;
  component_id: string | null;
  category: ComponentCategory | null;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  purchased_date: string | null;
  baseline_hours: number | null;
  service_interval_hours: number | null;
  status: ComponentStatus | null;
  location_site: string | null;
  notes: string | null;
  total_hours: number | null;
  hours_until_service: number | null;
  fitted_to_uav_id: string | null;
  fitted_to: string | null;
  fitted_on: string | null;
};

function round1(n: number | null): string {
  return n === null ? "0" : String(Math.round(n * 10) / 10);
}

// ---------------------------------------------------------------------------
// Form, shared by add and edit
// ---------------------------------------------------------------------------

function ComponentForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  showBaseline,
}: {
  initial?: ComponentRow;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (formData: FormData) => Promise<{ error: string | null }>;
  showBaseline: boolean;
}) {
  const [category, setCategory] = useState<ComponentCategory>(initial?.category ?? "propeller");
  const [status, setStatus] = useState<ComponentStatus>(initial?.status ?? "spare");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    formData.set("category", category);
    formData.set("status", status);
    if (!showBaseline) formData.set("baseline_hours", String(initial?.baseline_hours ?? 0));
    const result = await onSubmit(formData);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="component_id">Asset Tag</Label>
          <Input
            id="component_id"
            name="component_id"
            required
            placeholder="PRP-014"
            defaultValue={initial?.component_id ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => v && setCategory(v as ComponentCategory)}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v) => categoryLabel[v as ComponentCategory]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(categoryLabel) as ComponentCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Zenmuse L2 lidar payload"
          defaultValue={initial?.name ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input id="manufacturer" name="manufacturer" defaultValue={initial?.manufacturer ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="model">Model</Label>
          <Input id="model" name="model" defaultValue={initial?.model ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="serial_number">Serial</Label>
          <Input id="serial_number" name="serial_number" defaultValue={initial?.serial_number ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="purchased_date">Purchased</Label>
          <Input
            id="purchased_date"
            name="purchased_date"
            type="date"
            defaultValue={initial?.purchased_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="service_interval_hours">Service Interval (hrs)</Label>
          <Input
            id="service_interval_hours"
            name="service_interval_hours"
            type="number"
            min="1"
            step="1"
            placeholder="200"
            defaultValue={initial?.service_interval_hours ?? ""}
          />
          <p className="text-xs text-muted-foreground">Blank for parts with no service life.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v as ComponentStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v) => componentStatusLabel[v as ComponentStatus]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(componentStatusLabel) as ComponentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {componentStatusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showBaseline ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="baseline_hours">Existing Hours</Label>
          <Input id="baseline_hours" name="baseline_hours" type="number" min="0" step="0.1" placeholder="0" />
          <p className="text-xs text-muted-foreground">
            Hours already on the part. Flights flown while it is fitted are added to this.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="location_site">Location / Site</Label>
          <Input id="location_site" name="location_site" defaultValue={initial?.location_site ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddComponentDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          Add Part
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Part or Equipment</DialogTitle>
        </DialogHeader>
        {open ? (
          <ComponentForm
            submitLabel="Add part"
            pendingLabel="Adding..."
            showBaseline
            onSubmit={async (formData) => {
              const result = await addComponent(formData);
              if (!result.error) {
                toast.success("Part added.");
                setOpen(false);
              }
              return result;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Fitting
// ---------------------------------------------------------------------------

function FitDialog({
  component,
  uavs,
  open,
  onOpenChange,
}: {
  component: ComponentRow;
  uavs: UavOption[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [uavId, setUavId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fit {component.component_id} to an airframe</DialogTitle>
          <DialogDescription>
            From this date the part accrues that aircraft&apos;s flight hours. Backdate it if the
            part has already been flying.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Airframe</Label>
            <Select value={uavId} onValueChange={(v) => setUavId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select airframe">
                  {(v) => uavs.find((u) => u.id === v)?.label ?? "Select airframe"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {uavs.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fit_date">Fitted on</Label>
            <Input
              id="fit_date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!uavId || isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await installComponent(component.id, uavId, date);
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`${component.component_id} fitted.`);
                  onOpenChange(false);
                })
              }
            >
              {isPending ? "Fitting..." : "Fit part"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RowActions({ component, uavs }: { component: ComponentRow; uavs: UavOption[] }) {
  const [editing, setEditing] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [confirming, setConfirming] = useState<"remove" | "retire" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();
  const name = component.component_id ?? "this part";
  const fitted = Boolean(component.fitted_to);

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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit details
          </DropdownMenuItem>
          {component.status !== "retired" ? (
            fitted ? (
              <DropdownMenuItem onClick={() => setConfirming("remove")}>
                <Unplug className="size-4" />
                Remove from {component.fitted_to}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setFitting(true)}>
                <PlugZap className="size-4" />
                Fit to an airframe
              </DropdownMenuItem>
            )
          ) : null}
          {component.status !== "retired" && component.status !== "maintenance" ? (
            <DropdownMenuItem
              onClick={() =>
                run(() => setComponentStatus(component.id, "maintenance"), `${name} marked for maintenance.`)
              }
            >
              <Wrench className="size-4" />
              Mark for maintenance
            </DropdownMenuItem>
          ) : null}
          {component.status !== "retired" ? (
            <DropdownMenuItem onClick={() => setConfirming("retire")}>
              <Unplug className="size-4" />
              Retire part
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
            <Trash2 className="size-4" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {name}</DialogTitle>
          </DialogHeader>
          <ComponentForm
            key={component.id}
            initial={component}
            submitLabel="Save changes"
            pendingLabel="Saving..."
            showBaseline={false}
            onSubmit={async (formData) => {
              const result = await updateComponent(component.id, formData);
              if (!result.error) {
                toast.success(`${name} updated.`);
                setEditing(false);
              }
              return result;
            }}
          />
        </DialogContent>
      </Dialog>

      <FitDialog component={component} uavs={uavs} open={fitting} onOpenChange={setFitting} />

      <ConfirmDialog
        open={confirming === "remove"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Remove ${name} from ${component.fitted_to}?`}
        description={
          <>
            It stops accruing that aircraft&apos;s hours from today, and becomes a spare. The hours
            it has already put on are kept.
          </>
        }
        confirmLabel="Remove part"
        pending={isPending}
        onConfirm={() =>
          run(() => removeComponent(component.id, new Date().toISOString().slice(0, 10)), `${name} removed.`)
        }
      />

      <ConfirmDialog
        open={confirming === "retire"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Retire ${name}?`}
        description={
          <>
            {fitted
              ? "It comes off the airframe today and stops accruing hours. "
              : ""}
            Its service history is kept and it stops appearing as available equipment.
          </>
        }
        confirmLabel="Retire part"
        pending={isPending}
        onConfirm={() => run(() => setComponentStatus(component.id, "retired"), `${name} retired.`)}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Delete ${name} permanently?`}
        description={
          <>
            This cannot be undone, and only works while the part has never been fitted to an
            airframe. Anything with a fitting history must be retired instead.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        pending={isPending}
        onConfirm={() => run(() => deleteComponent(component.id), `${name} deleted.`)}
      />
    </>
  );
}

export function ComponentsTable({
  rows,
  uavs,
  canManage,
}: {
  rows: ComponentRow[];
  uavs: UavOption[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showRetired, setShowRetired] = useState(false);

  const retiredCount = rows.filter((r) => r.status === "retired").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!showRetired && row.status === "retired") return false;
      if (category !== "all" && row.category !== category) return false;
      if (q === "") return true;
      return [row.component_id, row.name, row.manufacturer, row.model, row.serial_number, row.fitted_to]
        .some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, category, showRetired]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by tag, name, serial, or airframe..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
          <SelectTrigger className="sm:w-44">
            <SelectValue>
              {(v) => (v === "all" ? "All categories" : categoryLabel[v as ComponentCategory])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.keys(categoryLabel) as ComponentCategory[]).map((c) => (
              <SelectItem key={c} value={c}>
                {categoryLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {retiredCount > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
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
              <TableHead>Tag</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Fitted To</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Until Service</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 9 : 8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? "No parts recorded yet. Add motors, propellers, payloads and equipment so their hours are tracked against the airframes they fly on."
                    : "No parts match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className={row.status === "retired" ? "opacity-60" : undefined}
                >
                  <TableCell className="pr-0">
                    <AttentionFlag
                      flags={componentFlags({
                        status: row.status ?? "spare",
                        hours_until_service: row.hours_until_service,
                        fitted_to: row.fitted_to,
                      })}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{row.component_id}</TableCell>
                  <TableCell className="max-w-52 truncate">
                    {row.name}
                    {row.manufacturer || row.model ? (
                      <span className="block text-xs text-muted-foreground">
                        {[row.manufacturer, row.model].filter(Boolean).join(" ")}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.category ? categoryLabel[row.category] : "—"}
                  </TableCell>
                  <TableCell>
                    {row.fitted_to ? (
                      <span>
                        {row.fitted_to}
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          since {row.fitted_on}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not fitted</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{round1(row.total_hours)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.hours_until_service !== null ? (
                      <span
                        className={
                          row.hours_until_service <= 0 ? "text-[var(--status-critical)]" : undefined
                        }
                      >
                        {round1(row.hours_until_service)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">no interval</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.status ? (
                      <StatusDot
                        tone={statusTone[row.status]}
                        label={componentStatusLabel[row.status]}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <RowActions component={row} uavs={uavs} />
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
