"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createChecklist } from "@/app/(portal)/checklists/actions";

type DraftItem = { key: number; prompt: string; critical: boolean };

/** A sensible starting point rather than an empty form. */
const STARTER: DraftItem[] = [
  { key: 1, prompt: "Airframe inspected for damage", critical: true },
  { key: 2, prompt: "Propellers secure and undamaged", critical: true },
  { key: 3, prompt: "Batteries charged and seated", critical: true },
  { key: 4, prompt: "Firmware current on aircraft and controller", critical: false },
  { key: 5, prompt: "Weather within limits", critical: true },
  { key: 6, prompt: "Airspace checked and authorisation held if required", critical: true },
  { key: 7, prompt: "Take-off and landing area clear", critical: true },
  { key: 8, prompt: "Crew briefed", critical: false },
];

export function ChecklistBuilder() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DraftItem[]>(STARTER);
  const [nextKey, setNextKey] = useState(100);
  const [loading, setLoading] = useState(false);

  function update(key: number, patch: Partial<DraftItem>) {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function addItem() {
    setItems((list) => [...list, { key: nextKey, prompt: "", critical: false }]);
    setNextKey((k) => k + 1);
  }

  function removeItem(key: number) {
    setItems((list) => list.filter((i) => i.key !== key));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    // Rebuilt from state so the two arrays stay index-aligned — a removed row
    // would otherwise shift the critical flags onto the wrong prompts.
    formData.delete("prompt");
    formData.delete("critical");
    for (const item of items) {
      formData.append("prompt", item.prompt);
      formData.append("critical", String(item.critical));
    }

    const result = await createChecklist(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Checklist created.");
    setOpen(false);
    setItems(STARTER);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="size-4" />
          New Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Checklist</DialogTitle>
          <DialogDescription>
            A checklist becomes fixed once a crew has completed it, so its items cannot be edited
            afterwards — get the list right here, and create a new version when it changes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Pre-flight — Matrice 350" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="applies_to_model">Aircraft Model</Label>
              <Input id="applies_to_model" name="applies_to_model" placeholder="Any" />
              <p className="text-xs text-muted-foreground">Blank applies it to every aircraft.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="When this list is used, and by whom."
            />
          </div>

          <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
              Items
            </legend>
            <p className="text-xs text-muted-foreground">
              Mark an item <strong>no-go</strong> when the aircraft does not fly until it is
              satisfied. A completion records whether every no-go item passed.
            </p>

            <ul className="flex flex-col gap-2">
              {items.map((item, index) => (
                <li key={item.key} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-2 flex w-5 shrink-0 items-center justify-center text-xs text-muted-foreground tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <Input
                    value={item.prompt}
                    onChange={(e) => update(item.key, { prompt: e.target.value })}
                    placeholder="What the crew must confirm"
                    aria-label={`Checklist item ${index + 1}`}
                  />
                  <label className="mt-1.5 flex shrink-0 items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={item.critical}
                      onChange={(e) => update(item.key, { critical: e.target.checked })}
                      className="size-4 accent-[var(--status-critical)]"
                    />
                    No-go
                  </label>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="mt-0.5"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => removeItem(item.key)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>

            <Button type="button" size="sm" variant="outline" className="w-fit" onClick={addItem}>
              <Plus className="size-4" />
              Add item
            </Button>
          </fieldset>

          <DialogFooter>
            <Button type="submit" disabled={loading || items.length === 0}>
              {loading ? "Creating..." : "Create checklist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
