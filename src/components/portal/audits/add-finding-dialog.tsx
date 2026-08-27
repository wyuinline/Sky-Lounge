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
import { severityOptions } from "@/lib/select-options";
import { addFinding } from "@/app/(portal)/audits/actions";

type Option = { id: string; label: string };

const NONE = "__none__";

/**
 * A labelled picker with an explicit "none".
 *
 * Defined at module scope, not inside the dialog: a component created during
 * render is a new type on every pass, so React would unmount and remount it —
 * and the select would lose its value each time anything else in the form
 * changed.
 */
function LinkPicker({
  label,
  hint,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  emptyLabel: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {(v) => (v === NONE ? emptyLabel : (options.find((o) => o.id === v)?.label ?? emptyLabel))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{emptyLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AddFindingDialog({
  audits,
  assignees,
  incidents = [],
  hazards = [],
  documents = [],
}: {
  audits: Option[];
  assignees: Option[];
  /** The safety loop: what raised this, what it addresses, what it changed. */
  incidents?: Option[];
  hazards?: Option[];
  documents?: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [auditId, setAuditId] = useState("");
  const [severity, setSeverity] = useState("low");
  const [assignedTo, setAssignedTo] = useState("");
  const [incidentId, setIncidentId] = useState(NONE);
  const [hazardId, setHazardId] = useState(NONE);
  const [documentId, setDocumentId] = useState(NONE);
  const [loading, setLoading] = useState(false);


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("audit_id", auditId);
    formData.set("severity", severity);
    formData.set("assigned_to", assignedTo);
    formData.set("incident_id", incidentId === NONE ? "" : incidentId);
    formData.set("hazard_id", hazardId === NONE ? "" : hazardId);
    formData.set("resulting_document_id", documentId === NONE ? "" : documentId);
    const result = await addFinding(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Finding added.");
    setOpen(false);
    setAuditId("");
    setSeverity("low");
    setAssignedTo("");
    setIncidentId(NONE);
    setHazardId(NONE);
    setDocumentId(NONE);
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          Add Finding
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Audit Finding</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Audit</Label>
            <Select value={auditId} onValueChange={(v) => setAuditId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select audit" />
              </SelectTrigger>
              <SelectContent>
                {audits.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" required placeholder="Describe the finding..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Severity</Label>
              <OptionSelect
                value={severity}
                onValueChange={setSeverity}
                options={severityOptions}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
          </div>
          <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
              Safety loop
            </legend>
            <p className="text-xs text-muted-foreground">
              What raised this finding, what hazard it addresses, and what procedure it changed.
              That trace — event to corrective action to revised document to retrained crew — is
              what a safety audit actually asks to see.
            </p>
            <LinkPicker
              label="Raised by incident"
              hint="The occurrence that revealed this, if there was one."
              value={incidentId}
              onChange={setIncidentId}
              options={incidents}
              emptyLabel="Not from an incident"
            />
            <LinkPicker
              label="Addresses hazard"
              hint="The hazard in the register this corrective action is aimed at."
              value={hazardId}
              onChange={setHazardId}
              options={hazards}
              emptyLabel="No hazard linked"
            />
            <LinkPicker
              label="Procedure changed"
              hint="The document revised as a result. Fill this in when the action is done."
              value={documentId}
              onChange={setDocumentId}
              options={documents}
              emptyLabel="No document changed"
            />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="training_required"
                className="mt-0.5 size-4 shrink-0 accent-[var(--brand-teal)]"
              />
              <span>
                Retraining required
                <span className="block text-xs text-muted-foreground">
                  Tick when the crew has to be briefed or retrained on the change.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label>Assigned To</Label>
            <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !auditId}>
              {loading ? "Adding..." : "Add Finding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
