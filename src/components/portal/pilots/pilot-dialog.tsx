"use client";

import { useState, type FormEvent, type ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPilot, updatePilot } from "@/app/(portal)/pilots/actions";

export type PilotFormValues = {
  id: string;
  full_name: string;
  certificate_number: string | null;
  certificate_type: "basic_operations" | "advanced_operations" | "level_1_complex" | null;
  certificate_issued: string | null;
  certificate_expires: string | null;
  last_recency_activity: string | null;
  notes: string | null;
};

/** The pilot form, shared by adding and editing. */
function PilotForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  footnote,
}: {
  initial?: PilotFormValues;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (formData: FormData) => Promise<{ error: string | null }>;
  footnote?: ReactNode;
}) {
  const [certificateType, setCertificateType] = useState(
    initial?.certificate_type ?? "advanced_operations",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("certificate_type", certificateType);
    const result = await onSubmit(formData);

    setLoading(false);
    if (result.error) toast.error(result.error);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="full_name">Pilot Name</Label>
          <Input
            id="full_name"
            name="full_name"
            required
            placeholder="Jordan Reyes"
            defaultValue={initial?.full_name ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="certificate_number">Certificate #</Label>
            <Input
              id="certificate_number"
              name="certificate_number"
              placeholder="PC2606190554"
              defaultValue={initial?.certificate_number ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Certificate Type</Label>
            <Select
              value={certificateType}
              onValueChange={(v) =>
                setCertificateType((v as typeof certificateType) ?? "advanced_operations")
              }
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
            <Input
              id="certificate_issued"
              name="certificate_issued"
              type="date"
              defaultValue={initial?.certificate_issued ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="certificate_expires">Expires</Label>
            <Input
              id="certificate_expires"
              name="certificate_expires"
              type="date"
              defaultValue={initial?.certificate_expires ?? ""}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="last_recency_activity">Last Recency Activity</Label>
          <Input
            id="last_recency_activity"
            name="last_recency_activity"
            type="date"
            defaultValue={initial?.last_recency_activity ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Recency is due 24 months after this date, and is calculated for you.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Anything worth recording about this pilot."
            defaultValue={initial?.notes ?? ""}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>
            {loading ? pendingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </form>
      {footnote}
    </>
  );
}

export function AddPilotDialog() {
  const [open, setOpen] = useState(false);

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
        {/* Remounted on open, so a cancelled entry is not still in the fields. */}
        {open ? (
          <PilotForm
            submitLabel="Add Pilot"
            pendingLabel="Adding..."
            footnote={
              <p className="text-xs text-muted-foreground">
                Upload the ROC-A certificate from the pilot&apos;s row once they are added.
              </p>
            }
            onSubmit={async (formData) => {
              const result = await addPilot(formData);
              if (!result.error) {
                toast.success("Pilot added to the registry.");
                setOpen(false);
              }
              return result;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function EditPilotDialog({
  pilot,
  open,
  onOpenChange,
}: {
  pilot: PilotFormValues | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {pilot?.full_name ?? "pilot"}</DialogTitle>
        </DialogHeader>
        {pilot ? (
          <PilotForm
            key={pilot.id}
            initial={pilot}
            submitLabel="Save changes"
            pendingLabel="Saving..."
            onSubmit={async (formData) => {
              const result = await updatePilot(pilot.id, formData);
              if (!result.error) {
                toast.success(`${formData.get("full_name")} updated.`);
                onOpenChange(false);
              }
              return result;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
