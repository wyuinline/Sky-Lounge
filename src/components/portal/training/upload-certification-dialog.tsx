"use client";

import { useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
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
import { uploadCertification } from "@/app/(portal)/training/actions";

type Option = { id: string; label: string };

export function UploadCertificationDialog({ pilots }: { pilots: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pilotId, setPilotId] = useState("");
  const [competencyLevel, setCompetencyLevel] = useState("beginner");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("pilot_id", pilotId);
    formData.set("competency_level", competencyLevel);
    const result = await uploadCertification(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Certification added.");
    setOpen(false);
    setPilotId("");
    setCompetencyLevel("beginner");
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Upload className="size-4" />
          Upload Certification
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Certification</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <Label htmlFor="certification_name">Certification Name</Label>
            <Input id="certification_name" name="certification_name" required placeholder="BVLOS Operations" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input id="issue_date" name="issue_date" type="date" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expiry_date">Expiry Date</Label>
              <Input id="expiry_date" name="expiry_date" type="date" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Competency Level</Label>
            <Select value={competencyLevel} onValueChange={(v) => setCompetencyLevel(v ?? "beginner")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !pilotId}>
              {loading ? "Uploading..." : "Upload Certification"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
