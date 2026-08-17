"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
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
import { submitFlightRequest } from "@/app/(portal)/flights/actions";

type Option = { id: string; label: string };

export function SubmitFlightRequestDialog({ pilots, uavs }: { pilots: Option[]; uavs: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pilotId, setPilotId] = useState("");
  const [uavId, setUavId] = useState("");
  const [riskLevel, setRiskLevel] = useState("low");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("pilot_id", pilotId);
    formData.set("uav_id", uavId);
    formData.set("risk_level", riskLevel);
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
      <DialogContent>
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
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="Site 4 — North Ridge" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="requested_date">Requested Date</Label>
              <Input id="requested_date" name="requested_date" type="date" required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Risk Level</Label>
            <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v ?? "low")}>
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
