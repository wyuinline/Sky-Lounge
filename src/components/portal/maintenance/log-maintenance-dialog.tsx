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
import { OptionSelect } from "@/components/portal/option-select";
import { maintenanceTypeOptions } from "@/lib/select-options";
import { logMaintenance } from "@/app/(portal)/maintenance/actions";

type Option = { id: string; label: string };

export function LogMaintenanceDialog({ uavs, technicians }: { uavs: Option[]; technicians: Option[] }) {
  const [open, setOpen] = useState(false);
  const [uavId, setUavId] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("preventive");
  const [technicianId, setTechnicianId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("uav_id", uavId);
    formData.set("maintenance_type", maintenanceType);
    formData.set("technician_id", technicianId);
    const result = await logMaintenance(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Maintenance record logged.");
    setOpen(false);
    setUavId("");
    setMaintenanceType("preventive");
    setTechnicianId("");
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="size-4" />
          Log Maintenance Record
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Maintenance Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>UAV</Label>
              <Select value={uavId} onValueChange={(v) => setUavId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select UAV" />
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
              <Label>Maintenance Type</Label>
              <OptionSelect
                value={maintenanceType}
                onValueChange={setMaintenanceType}
                options={maintenanceTypeOptions}
                className="w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="next_service_date">Next Service Date</Label>
              <Input id="next_service_date" name="next_service_date" type="date" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Technician</Label>
              <Select value={technicianId} onValueChange={(v) => setTechnicianId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Parts replaced, findings, etc." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !uavId}>
              {loading ? "Logging..." : "Log Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
