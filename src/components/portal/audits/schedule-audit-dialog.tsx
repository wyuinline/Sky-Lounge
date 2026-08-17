"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
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
import { scheduleAudit } from "@/app/(portal)/audits/actions";

type Option = { id: string; label: string };

export function ScheduleAuditDialog({ auditors }: { auditors: Option[] }) {
  const [open, setOpen] = useState(false);
  const [auditType, setAuditType] = useState("internal");
  const [auditorId, setAuditorId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("audit_type", auditType);
    formData.set("auditor_id", auditorId);
    const result = await scheduleAudit(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Audit scheduled.");
    setOpen(false);
    setAuditType("internal");
    setAuditorId("");
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="size-4" />
          Schedule New Audit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule New Audit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Audit Type</Label>
              <Select value={auditType} onValueChange={(v) => setAuditType(v ?? "internal")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="regulatory">Regulatory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="audit_date">Audit Date</Label>
              <Input id="audit_date" name="audit_date" type="date" required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Auditor</Label>
            <Select value={auditorId} onValueChange={(v) => setAuditorId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select auditor" />
              </SelectTrigger>
              <SelectContent>
                {auditors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule Audit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
