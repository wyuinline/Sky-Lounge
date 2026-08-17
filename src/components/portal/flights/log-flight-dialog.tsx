"use client";

import { useState, type FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logFlight } from "@/app/(portal)/flights/actions";

type Option = { id: string; label: string };

export function LogFlightDialog({ pilots, uavs }: { pilots: Option[]; uavs: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pilotId, setPilotId] = useState("");
  const [uavId, setUavId] = useState("");
  const [outcome, setOutcome] = useState("completed");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("pilot_id", pilotId);
    formData.set("uav_id", uavId);
    formData.set("mission_outcome", outcome);
    const result = await logFlight(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Flight log recorded.");
    setOpen(false);
    setPilotId("");
    setUavId("");
    setOutcome("completed");
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <ClipboardList className="size-4" />
          Log Flight
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post-Flight Report</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Pilot</Label>
              <Select value={pilotId} onValueChange={(v) => setPilotId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select pilot" />
                </SelectTrigger>
                <SelectContent>
                  {pilots.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="flight_date">Flight Date</Label>
              <Input id="flight_date" name="flight_date" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input id="duration_minutes" name="duration_minutes" type="number" min={0} placeholder="45" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="weather_conditions">Weather Conditions</Label>
            <Input id="weather_conditions" name="weather_conditions" placeholder="Clear, wind 8kt" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Mission Outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v ?? "completed")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="aborted">Aborted</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !pilotId || !uavId}>
              {loading ? "Saving..." : "Save Flight Log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
