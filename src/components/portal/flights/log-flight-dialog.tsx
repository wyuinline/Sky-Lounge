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
  DialogDescription,
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
import { logFlight } from "@/app/(portal)/flights/actions";

type Option = { id: string; label: string };

const NO_AIRSPACE = "__unset__";

const airspaceLabel: Record<string, string> = {
  [NO_AIRSPACE]: "Not recorded",
  uncontrolled: "Uncontrolled (Class G)",
  controlled: "Controlled",
  restricted: "Restricted",
  advisory: "Advisory",
};

/**
 * The operational categories that decide which rules a flight was under.
 * Recording them is what lets a report later distinguish a routine survey from
 * an operation that needed specific authorisation.
 */
const categories = [
  { name: "is_night", label: "Night", hint: "Between civil twilight" },
  { name: "is_bvlos", label: "Beyond line of sight", hint: "BVLOS" },
  { name: "is_over_people", label: "Over people", hint: "Not the crew" },
  { name: "is_sheltered", label: "Sheltered", hint: "Within 100 m of a structure" },
];

export function LogFlightDialog({
  pilots,
  uavs,
  batteries,
}: {
  pilots: Option[];
  uavs: Option[];
  batteries: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [pilotId, setPilotId] = useState("");
  const [uavId, setUavId] = useState("");
  const [outcome, setOutcome] = useState("completed");
  const [airspace, setAirspace] = useState(NO_AIRSPACE);
  const [selectedBatteries, setSelectedBatteries] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  }

  function reset() {
    setPilotId("");
    setUavId("");
    setOutcome("completed");
    setAirspace(NO_AIRSPACE);
    setSelectedBatteries([]);
    setObservers([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("pilot_id", pilotId);
    formData.set("uav_id", uavId);
    formData.set("mission_outcome", outcome);
    formData.set("airspace", airspace === NO_AIRSPACE ? "" : airspace);
    for (const id of selectedBatteries) formData.append("battery_ids", id);
    for (const id of observers) formData.append("observer_ids", id);

    const result = await logFlight(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Flight log recorded.");
    setOpen(false);
    reset();
    form.reset();
  }

  // The pilot in command cannot also be their own visual observer.
  const observerOptions = pilots.filter((p) => p.id !== pilotId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <ClipboardList className="size-4" />
          Log Flight
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Post-Flight Report</DialogTitle>
          <DialogDescription>
            Times and location are optional but make the record defensible. Give a duration, or both
            takeoff and landing times — with both, the duration is calculated for you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Pilot in command</Label>
              <Select value={pilotId} onValueChange={(v) => setPilotId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select pilot">
                    {(v) => pilots.find((p) => p.id === v)?.label ?? "Select pilot"}
                  </SelectValue>
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
                  <SelectValue placeholder="Select UAV">
                    {(v) => uavs.find((u) => u.id === v)?.label ?? "Select UAV"}
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
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="flight_date">Flight Date</Label>
              <Input id="flight_date" name="flight_date" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="takeoff_time">Takeoff</Label>
              <Input id="takeoff_time" name="takeoff_time" type="time" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="landing_time">Landing</Label>
              <Input id="landing_time" name="landing_time" type="time" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration_minutes">Duration (min)</Label>
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min={0}
                placeholder="45"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="location_name">Site / Location</Label>
              <Input id="location_name" name="location_name" placeholder="Acheson pit, north cell" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                name="latitude"
                type="number"
                step="0.000001"
                placeholder="53.5461"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                name="longitude"
                type="number"
                step="0.000001"
                placeholder="-113.4938"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>Airspace</Label>
              <Select value={airspace} onValueChange={(v) => v && setAirspace(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v) => airspaceLabel[v as string] ?? "Not recorded"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AIRSPACE}>Not recorded</SelectItem>
                  <SelectItem value="uncontrolled">Uncontrolled (Class G)</SelectItem>
                  <SelectItem value="controlled">Controlled</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="advisory">Advisory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="max_altitude_m">Max Altitude (m AGL)</Label>
              <Input
                id="max_altitude_m"
                name="max_altitude_m"
                type="number"
                min={0}
                step="0.1"
                placeholder="90"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sfoc_reference">SFOC Reference</Label>
              <Input id="sfoc_reference" name="sfoc_reference" placeholder="If one applied" />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
              Operation type
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categories.map((c) => (
                <label key={c.name} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={c.name}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--brand-teal)]"
                  />
                  <span>
                    {c.label}
                    <span className="block text-xs text-muted-foreground">{c.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {batteries.length > 0 ? (
            <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
              <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
                Batteries flown
              </legend>
              <p className="text-xs text-muted-foreground">
                Each pack selected gains a cycle. This is the only thing that keeps their remaining
                life honest.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {batteries.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedBatteries.includes(b.id)}
                      onChange={() => toggle(selectedBatteries, setSelectedBatteries, b.id)}
                      className="size-4 shrink-0 accent-[var(--brand-teal)]"
                    />
                    {b.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {observerOptions.length > 0 ? (
            <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
              <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
                Visual observers
              </legend>
              <p className="text-xs text-muted-foreground">
                Naming the observer is what makes an extended-line-of-sight operation defensible.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {observerOptions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={observers.includes(p.id)}
                      onChange={() => toggle(observers, setObservers, p.id)}
                      className="size-4 shrink-0 accent-[var(--brand-teal)]"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="weather_conditions">Weather Conditions</Label>
              <Input
                id="weather_conditions"
                name="weather_conditions"
                placeholder="Clear, wind 8kt"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Mission Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v ?? "completed")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => ({ completed: "Completed", aborted: "Aborted", partial: "Partial" })[v as string] ?? "Completed"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="aborted">Aborted</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
