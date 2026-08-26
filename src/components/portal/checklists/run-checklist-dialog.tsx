"use client";

import { useState, type FormEvent } from "react";
import { ClipboardCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { completeChecklist } from "@/app/(portal)/checklists/actions";

export type ChecklistItem = { id: string; prompt: string; critical: boolean };

export type RunnableChecklist = {
  id: string;
  name: string;
  description: string | null;
  applies_to_model: string | null;
  items: ChecklistItem[];
};

type UavOption = { id: string; label: string };

export function RunChecklistDialog({
  checklists,
  uavs,
}: {
  checklists: RunnableChecklist[];
  uavs: UavOption[];
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(checklists[0]?.id ?? "");
  const [uavId, setUavId] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const template = checklists.find((c) => c.id === templateId) ?? null;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function chooseTemplate(id: string) {
    setTemplateId(id);
    // Ticks belong to the list they were made against; carrying them over
    // would silently pre-tick a different checklist.
    setChecked(new Set());
  }

  const outstandingCritical =
    template?.items.filter((i) => i.critical && !checked.has(i.id)) ?? [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!template) return;
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("template_id", template.id);
    formData.set("uav_id", uavId);
    for (const id of checked) formData.append("checked", id);

    const result = await completeChecklist(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.allCriticalPassed) {
      toast.success("Checklist completed. All no-go items passed.");
    } else {
      // Recorded either way — an honest record of a failed check is the point
      // of having one — but the crew should not leave thinking it passed.
      toast.warning("Checklist recorded with no-go items outstanding. The aircraft should not fly.");
    }

    setOpen(false);
    setChecked(new Set());
    setUavId("");
    form.reset();
  }

  if (checklists.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <ClipboardCheck className="size-4" />
          Run Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Run a checklist</DialogTitle>
          <DialogDescription>
            Tick what you have actually confirmed. The record is kept either way — a check with
            items outstanding is a fact worth having.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Checklist</Label>
              <Select value={templateId} onValueChange={(v) => v && chooseTemplate(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => checklists.find((c) => c.id === v)?.name ?? "Select"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {checklists.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Aircraft</Label>
              <Select value={uavId} onValueChange={(v) => setUavId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select aircraft">
                    {(v) => uavs.find((u) => u.id === v)?.label ?? "Select aircraft"}
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

          {template ? (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {template.items.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-brand-mist/40">
                    <input
                      type="checkbox"
                      checked={checked.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--brand-teal)]"
                    />
                    <span className="flex-1 text-sm">{item.prompt}</span>
                    {item.critical ? (
                      <span className="mt-0.5 shrink-0 rounded-sm border border-[var(--status-critical)]/50 bg-[var(--status-critical)]/10 px-1 py-0.5 text-[0.6rem] font-semibold tracking-wide text-[var(--status-critical)]">
                        NO-GO
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          ) : null}

          {outstandingCritical.length > 0 ? (
            <p className="flex items-start gap-2 rounded-md border border-[var(--status-critical)]/40 bg-[var(--status-critical)]/8 px-3 py-2 text-sm text-[var(--status-critical)]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                {outstandingCritical.length} no-go{" "}
                {outstandingCritical.length === 1 ? "item is" : "items are"} outstanding. You can
                still record this, but the aircraft should not fly.
              </span>
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Anything the check turned up." />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !template}>
              {loading ? "Recording..." : "Record completion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
