"use client";

import { useState, type FormEvent, type ReactNode } from "react";
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
import { addUav, updateUav } from "@/app/(portal)/fleet/actions";

export type UavFormValues = {
  id: string;
  drone_id: string | null;
  model: string | null;
  manufacturer: string | null;
  registration_number: string | null;
  serial_number: string | null;
  weight_kg: number | null;
  purchased_date: string | null;
  location_site: string | null;
  maintenance_interval_hours: number | null;
  next_inspection_date: string | null;
  notes: string | null;
  status: "airworthy" | "maintenance" | "grounded" | "retired" | null;
  baseline_flight_hours: number | null;
};

/**
 * The airframe form, shared by adding and editing.
 *
 * One form for both so the two cannot drift into asking for different things —
 * the server validates them through a single function for the same reason.
 * Fields are uncontrolled with defaults, so editing starts from what is on
 * record without a controlled-input state machine per field.
 */
function UavForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  extraFields,
}: {
  initial?: UavFormValues;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (formData: FormData) => Promise<{ error: string | null }>;
  extraFields?: ReactNode;
}) {
  const [status, setStatus] = useState(initial?.status ?? "airworthy");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("status", status);
    const result = await onSubmit(formData);

    setLoading(false);
    if (result.error) toast.error(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="drone_id">Drone ID</Label>
          <Input
            id="drone_id"
            name="drone_id"
            required
            placeholder="UAV-014"
            defaultValue={initial?.drone_id ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            name="model"
            required
            placeholder="Matrice 350 RTK"
            defaultValue={initial?.model ?? ""}
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
          <Label htmlFor="registration_number">Registration Number</Label>
          <Input
            id="registration_number"
            name="registration_number"
            placeholder="C00000000"
            defaultValue={initial?.registration_number ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="serial_number">Serial Number</Label>
          <Input
            id="serial_number"
            name="serial_number"
            placeholder="1FN0000000000000"
            defaultValue={initial?.serial_number ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="weight_kg">Weight (kg)</Label>
          <Input
            id="weight_kg"
            name="weight_kg"
            type="number"
            step="0.001"
            min="0"
            placeholder="0.915"
            defaultValue={initial?.weight_kg ?? ""}
          />
          <p className="text-xs text-muted-foreground">250 g–25 kg requires registration.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="location_site">Location / Site</Label>
          <Input
            id="location_site"
            name="location_site"
            placeholder="Acheson Office"
            defaultValue={initial?.location_site ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="purchased_date">Purchased</Label>
          <Input
            id="purchased_date"
            name="purchased_date"
            type="date"
            defaultValue={initial?.purchased_date ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="maintenance_interval_hours">Maint. Interval (hrs)</Label>
          <Input
            id="maintenance_interval_hours"
            name="maintenance_interval_hours"
            type="number"
            min="1"
            step="1"
            placeholder="200"
            defaultValue={initial?.maintenance_interval_hours ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="next_inspection_date">Next Inspection Date</Label>
          <Input
            id="next_inspection_date"
            name="next_inspection_date"
            type="date"
            defaultValue={initial?.next_inspection_date ?? ""}
          />
        </div>
      </div>

      {extraFields}

      <div className="flex flex-col gap-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus((v as typeof status) ?? "airworthy")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="airworthy">Airworthy</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="grounded">Grounded</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Anything the crew should know about this airframe."
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

export function AddUavDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="size-4" />
          Add New UAV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New UAV</DialogTitle>
        </DialogHeader>
        {/* Remounted each time it opens, so a cancelled entry is not still
            sitting in the fields on the next open. */}
        {open ? (
          <UavForm
            submitLabel="Add UAV"
            pendingLabel="Adding..."
            extraFields={
              <div className="flex flex-col gap-2">
                <Label htmlFor="baseline_flight_hours">Existing Flight Hours</Label>
                <Input
                  id="baseline_flight_hours"
                  name="baseline_flight_hours"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Hours already on the airframe. Flights logged here are added to this.
                </p>
              </div>
            }
            onSubmit={async (formData) => {
              const result = await addUav(formData);
              if (!result.error) {
                toast.success("UAV added to the fleet.");
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

export function EditUavDialog({
  uav,
  open,
  onOpenChange,
}: {
  uav: UavFormValues | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {uav?.drone_id ?? "airframe"}</DialogTitle>
        </DialogHeader>
        {uav ? (
          <UavForm
            key={uav.id}
            initial={uav}
            submitLabel="Save changes"
            pendingLabel="Saving..."
            onSubmit={async (formData) => {
              // Baseline hours are set once when the airframe is first
              // recorded. Editing them here would silently move every
              // hours-based service interval, so the field is not offered and
              // the stored value is resubmitted unchanged.
              formData.set("baseline_flight_hours", String(uav.baseline_flight_hours ?? 0));
              const result = await updateUav(uav.id, formData);
              if (!result.error) {
                toast.success(`${formData.get("drone_id")} updated.`);
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
