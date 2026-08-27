"use client";

import { useState, type FormEvent } from "react";
import { Send, ExternalLink } from "lucide-react";
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
import { severityOptions } from "@/lib/select-options";
import { submitFlightRequest } from "@/app/(portal)/flights/actions";
import {
  operationOrder,
  operationLabel,
  operationDescription,
  type OperationType,
} from "@/lib/operations";

type Option = { id: string; label: string };

const NO_PROJECT = "__none__";

export function SubmitFlightRequestDialog({
  pilots,
  uavs,
  projects,
}: {
  pilots: Option[];
  uavs: Option[];
  projects: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [pilotId, setPilotId] = useState("");
  const [uavId, setUavId] = useState("");
  const [riskLevel, setRiskLevel] = useState("low");
  const [projectId, setProjectId] = useState(NO_PROJECT);
  // VLOS is the baseline every flight needs, so it starts selected rather
  // than being something a requester has to remember to tick.
  const [operations, setOperations] = useState<OperationType[]>(["vlos"]);
  const [loading, setLoading] = useState(false);

  function toggleOperation(op: OperationType) {
    setOperations((current) => {
      if (current.includes(op)) return current.filter((o) => o !== op);
      // The three sight categories are mutually exclusive: a flight is in
      // sight, in sight through an observer, or out of sight.
      const sight: OperationType[] = ["vlos", "evlos", "bvlos"];
      const next = sight.includes(op) ? current.filter((o) => !sight.includes(o)) : current;
      return [...next, op];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("pilot_id", pilotId);
    formData.set("uav_id", uavId);
    formData.set("risk_level", riskLevel);
    formData.set("project_id", projectId === NO_PROJECT ? "" : projectId);
    for (const op of operations) formData.append("operations", op);
    const result = await submitFlightRequest(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Flight request submitted.");
    setOpen(false);
    setPilotId("");
    setUavId("");
    setRiskLevel("low");
    setProjectId(NO_PROJECT);
    setOperations(["vlos"]);
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Send className="size-4" />
          Submit Flight Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Submit Flight Request</DialogTitle>
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
              <Label>Project</Label>
              <Select value={projectId} onValueChange={(v) => v && setProjectId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) =>
                      v === NO_PROJECT
                        ? "Not attributed"
                        : (projects.find((p) => p.id === v)?.label ?? "Not attributed")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>Not attributed</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="requested_date">Requested Date</Label>
              <Input id="requested_date" name="requested_date" type="date" required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" placeholder="Site 4 — North Ridge" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Risk Level</Label>
            <OptionSelect
              value={riskLevel}
              onValueChange={setRiskLevel}
              options={severityOptions}
              className="w-full"
            />
          </div>
          <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
              What the flight is doing
            </legend>
            <p className="text-xs text-muted-foreground">
              Checked against the pilot&apos;s authorisations before the request is accepted, and
              again before it is approved. A current certificate says they may fly; an
              authorisation says what they may fly.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {operationOrder.map((op) => (
                <label key={op} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={operations.includes(op)}
                    onChange={() => toggleOperation(op)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--brand-teal)]"
                  />
                  <span>
                    {operationLabel[op]}
                    <span className="block text-xs text-muted-foreground">
                      {operationDescription[op]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
              Controlled airspace
            </legend>
            <p className="text-xs text-muted-foreground">
              Authorisation for controlled airspace is obtained from NAV Drone, which publishes no
              interface for other systems to use. Get it there, then record the reference here so
              the flight carries its own evidence.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="airspace_authorisation">Authorisation Reference</Label>
                <Input
                  id="airspace_authorisation"
                  name="airspace_authorisation"
                  placeholder="Leave blank for uncontrolled airspace"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="airspace_authorisation_expires">Valid Until</Label>
                <Input
                  id="airspace_authorisation_expires"
                  name="airspace_authorisation_expires"
                  type="date"
                />
              </div>
            </div>
            <a
              href="https://www.navcanada.ca/en/flight-planning/drone-flight-planning.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1.5 text-xs text-brand-teal underline underline-offset-2"
            >
              Open NAV Drone
              <ExternalLink className="size-3" />
            </a>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="risk_assessment">Risk Assessment</Label>
            <Textarea
              id="risk_assessment"
              name="risk_assessment"
              placeholder="Summarize hazards, mitigations, and airspace considerations..."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !pilotId || !uavId}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
