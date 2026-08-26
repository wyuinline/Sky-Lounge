"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addBattery, updateBattery } from "@/app/(portal)/fleet/battery-actions";

export type BatteryStatus = "serviceable" | "monitor" | "retired";

export const batteryStatusLabel: Record<BatteryStatus, string> = {
  serviceable: "Serviceable",
  monitor: "Monitor",
  retired: "Retired",
};

export type BatteryFormValues = {
  id: string;
  battery_id: string | null;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  capacity_mah: number | null;
  cell_count: number | null;
  purchased_date: string | null;
  baseline_cycles: number | null;
  cycle_limit: number | null;
  status: BatteryStatus | null;
  location_site: string | null;
  notes: string | null;
};

function BatteryForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  showBaseline,
}: {
  initial?: BatteryFormValues;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (formData: FormData) => Promise<{ error: string | null }>;
  showBaseline: boolean;
}) {
  const [status, setStatus] = useState<BatteryStatus>(initial?.status ?? "serviceable");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    formData.set("status", status);
    if (!showBaseline) formData.set("baseline_cycles", String(initial?.baseline_cycles ?? 0));
    const result = await onSubmit(formData);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="battery_id">Battery ID</Label>
          <Input
            id="battery_id"
            name="battery_id"
            required
            placeholder="BAT-004"
            defaultValue={initial?.battery_id ?? ""}
          />
          <p className="text-xs text-muted-foreground">Whatever is written on the pack.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="serial_number">Serial Number</Label>
          <Input
            id="serial_number"
            name="serial_number"
            placeholder="0X8ZK2..."
            defaultValue={initial?.serial_number ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            name="manufacturer"
            placeholder="DJI"
            defaultValue={initial?.manufacturer ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            name="model"
            placeholder="TB65"
            defaultValue={initial?.model ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="capacity_mah">Capacity (mAh)</Label>
          <Input
            id="capacity_mah"
            name="capacity_mah"
            type="number"
            min="1"
            step="1"
            placeholder="5880"
            defaultValue={initial?.capacity_mah ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cell_count">Cells</Label>
          <Input
            id="cell_count"
            name="cell_count"
            type="number"
            min="1"
            step="1"
            placeholder="12"
            defaultValue={initial?.cell_count ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
          <Label htmlFor="cycle_limit">Rated Cycle Limit</Label>
          <Input
            id="cycle_limit"
            name="cycle_limit"
            type="number"
            min="1"
            step="1"
            placeholder="200"
            defaultValue={initial?.cycle_limit ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank if unknown — no retirement deadline is then claimed.
          </p>
        </div>
      </div>

      {showBaseline ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="baseline_cycles">Existing Cycles</Label>
          <Input
            id="baseline_cycles"
            name="baseline_cycles"
            type="number"
            min="0"
            step="1"
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Cycles already on the pack. Flights logged here are added to this.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v as BatteryStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v) => batteryStatusLabel[v as BatteryStatus]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="serviceable">Serviceable</SelectItem>
              <SelectItem value="monitor">Monitor</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location_site">Location / Site</Label>
          <Input
            id="location_site"
            name="location_site"
            placeholder="Acheson Office"
            defaultValue={initial?.location_site ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Swelling, capacity loss, anything the crew should know."
          defaultValue={initial?.notes ?? ""}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddBatteryDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          Add Battery
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Battery</DialogTitle>
        </DialogHeader>
        {open ? (
          <BatteryForm
            submitLabel="Add battery"
            pendingLabel="Adding..."
            showBaseline
            onSubmit={async (formData) => {
              const result = await addBattery(formData);
              if (!result.error) {
                toast.success("Battery added to the fleet.");
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

export function EditBatteryDialog({
  battery,
  open,
  onOpenChange,
}: {
  battery: BatteryFormValues | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {battery?.battery_id ?? "battery"}</DialogTitle>
        </DialogHeader>
        {battery ? (
          <BatteryForm
            key={battery.id}
            initial={battery}
            submitLabel="Save changes"
            pendingLabel="Saving..."
            // Existing cycles are set once, when the pack is first recorded.
            // Editing them afterwards would silently move its remaining life.
            showBaseline={false}
            onSubmit={async (formData) => {
              const result = await updateBattery(battery.id, formData);
              if (!result.error) {
                toast.success(`${formData.get("battery_id")} updated.`);
                onOpenChange(false);
              }
              return result;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
