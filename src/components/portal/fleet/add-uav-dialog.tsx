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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addUav } from "@/app/(portal)/fleet/actions";

export function AddUavDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("airworthy");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("status", status);
    const result = await addUav(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("UAV added to the fleet.");
    setOpen(false);
    setStatus("airworthy");
    event.currentTarget.reset();
  }

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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="drone_id">Drone ID</Label>
              <Input id="drone_id" name="drone_id" required placeholder="UAV-014" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" required placeholder="Matrice 350 RTK" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input id="manufacturer" name="manufacturer" placeholder="DJI" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="firmware_version">Firmware Version</Label>
              <Input id="firmware_version" name="firmware_version" placeholder="1.0.1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="registration_number">Registration Number</Label>
              <Input id="registration_number" name="registration_number" placeholder="C00000000" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="serial_number">Serial Number</Label>
              <Input id="serial_number" name="serial_number" placeholder="1FN0000000000000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight_kg">Weight (kg)</Label>
              <Input
                id="weight_kg"
                name="weight_kg"
                type="number"
                step="0.001"
                min="0"
                placeholder="0.915"
              />
              <p className="text-xs text-muted-foreground">
                250 g–25 kg requires registration.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="purchased_date">Purchased</Label>
              <Input id="purchased_date" name="purchased_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="location_site">Location / Site</Label>
              <Input id="location_site" name="location_site" placeholder="Acheson Office" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="maintenance_interval_hours">Maint. Interval (hrs)</Label>
              <Input
                id="maintenance_interval_hours"
                name="maintenance_interval_hours"
                type="number"
                min="1"
                step="1"
                placeholder="200"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value ?? "airworthy")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="airworthy">Airworthy</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="grounded">Grounded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="next_inspection_date">Next Inspection Date</Label>
              <Input id="next_inspection_date" name="next_inspection_date" type="date" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Anything the crew should know about this airframe." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add UAV"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
