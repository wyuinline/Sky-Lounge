"use client";

import { useState, type FormEvent } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportIncident } from "@/app/(portal)/incidents/actions";

type Option = { id: string; label: string };

export function ReportIncidentDialog({ pilots, uavs }: { pilots: Option[]; uavs: Option[] }) {
  const [open, setOpen] = useState(false);
  const [incidentType, setIncidentType] = useState("near_miss");
  const [severity, setSeverity] = useState("low");
  const [uavId, setUavId] = useState("");
  const [pilotId, setPilotId] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("incident_type", incidentType);
    formData.set("severity", severity);
    formData.set("uav_id", uavId);
    formData.set("pilot_id", pilotId);
    formData.set("is_anonymous", isAnonymous ? "true" : "false");
    const result = await reportIncident(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Incident reported. Thank you for helping keep operations safe.");
    setOpen(false);
    setIncidentType("near_miss");
    setSeverity("low");
    setUavId("");
    setPilotId("");
    setIsAnonymous(false);
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="lg" variant="destructive">
          <ShieldAlert className="size-4" />
          Report New Incident
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an Incident</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="incident_date">Incident Date</Label>
              <Input id="incident_date" name="incident_date" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Incident Type</Label>
              <Select value={incidentType} onValueChange={(v) => setIncidentType(v ?? "near_miss")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="near_miss">Near Miss</SelectItem>
                  <SelectItem value="crash">Crash</SelectItem>
                  <SelectItem value="equipment_failure">Equipment Failure</SelectItem>
                  <SelectItem value="safety_hazard">Safety Hazard</SelectItem>
                  <SelectItem value="regulatory_breach">Regulatory Breach</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>UAV (optional)</Label>
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
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v ?? "low")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_anonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked === true)}
            />
            <Label htmlFor="is_anonymous" className="font-normal">
              Report anonymously
            </Label>
          </div>
          {!isAnonymous && (
            <div className="flex flex-col gap-2">
              <Label>Pilot (optional)</Label>
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
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" required placeholder="What happened?" />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
