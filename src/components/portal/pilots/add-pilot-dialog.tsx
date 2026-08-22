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
import { addPilot } from "@/app/(portal)/pilots/actions";

export function AddPilotDialog() {
  const [open, setOpen] = useState(false);
  const [certificateType, setCertificateType] = useState("advanced_operations");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("certificate_type", certificateType);
    const result = await addPilot(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Pilot added to the registry.");
    setOpen(false);
    setCertificateType("advanced_operations");
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="size-4" />
          Add New Pilot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Pilot</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="full_name">Pilot Name</Label>
            <Input id="full_name" name="full_name" required placeholder="Jordan Reyes" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="certificate_number">Certificate #</Label>
              <Input id="certificate_number" name="certificate_number" placeholder="PC2606190554" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Certificate Type</Label>
              <Select
                value={certificateType}
                onValueChange={(v) => setCertificateType(v ?? "advanced_operations")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic_operations">Basic Operations</SelectItem>
                  <SelectItem value="advanced_operations">Advanced Operations</SelectItem>
                  <SelectItem value="level_1_complex">Level 1 Complex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="certificate_issued">Issued</Label>
              <Input id="certificate_issued" name="certificate_issued" type="date" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="certificate_expires">Expires</Label>
              <Input id="certificate_expires" name="certificate_expires" type="date" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="last_recency_activity">Last Recency Activity</Label>
            <Input id="last_recency_activity" name="last_recency_activity" type="date" />
            <p className="text-xs text-muted-foreground">
              Recency is due 24 months after this date, and is calculated for you.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Anything worth recording about this pilot." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Pilot"}
            </Button>
          </DialogFooter>
        </form>
        <p className="text-xs text-muted-foreground">
          Upload the ROC-A certificate from the pilot&apos;s row once they are added.
        </p>
      </DialogContent>
    </Dialog>
  );
}
