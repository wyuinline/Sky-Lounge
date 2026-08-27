"use client";

import { useState, useTransition } from "react";
import { Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import { intervalSummary } from "@/lib/inspection-plans";
import {
  createInspectionPlan,
  addPlanItem,
  deletePlanItem,
  setPlanActive,
  setPlanAssignment,
} from "@/app/(portal)/maintenance/plan-actions";

export type PlanItem = {
  id: string;
  name: string;
  description: string | null;
  interval_hours: number | null;
  interval_cycles: number | null;
  interval_months: number | null;
  is_critical: boolean;
  sort_order: number;
};

export type Plan = {
  id: string;
  name: string;
  applies_to_model: string | null;
  description: string | null;
  active: boolean;
  items: PlanItem[];
  assignedUavIds: string[];
};

export type PlanAircraft = { id: string; drone_id: string; model: string | null };

/** The three interval fields, shared by the item form. */
function IntervalFields() {
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
        Falls due on whichever comes first
      </legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interval_hours">Flight hours</Label>
          <Input id="interval_hours" name="interval_hours" type="number" min="0" step="0.5" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interval_cycles">Flights</Label>
          <Input id="interval_cycles" name="interval_cycles" type="number" min="1" step="1" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interval_months">Months</Label>
          <Input id="interval_months" name="interval_months" type="number" min="1" step="1" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave a field blank to ignore that clock. At least one is needed — an item with no interval
        can never fall due.
      </p>
    </fieldset>
  );
}

function AddItemDialog({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        Add item
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              const form = event.currentTarget;
              const result = await addPlanItem(plan.id, new FormData(form));
              setSaving(false);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              form.reset();
              setOpen(false);
              toast.success("Item added.");
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Add an item to {plan.name}</DialogTitle>
              <DialogDescription>
                Every aircraft the plan covers picks this up, with its next due point derived from
                the work already recorded against it.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="item_name">Item</Label>
              <Input id="item_name" name="name" placeholder="Propeller inspection" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="item_description">What it involves (optional)</Label>
              <Textarea
                id="item_description"
                name="description"
                rows={2}
                placeholder="Check for nicks, delamination and hub play. Replace as a set."
              />
            </div>

            <IntervalFields />

            <label className="flex items-start gap-2 text-sm">
              <Checkbox name="is_critical" className="mt-0.5" />
              <span>
                Critical
                <span className="block text-xs text-muted-foreground">
                  An overdue critical item holds the aircraft on the ground. An overdue ordinary
                  item is flagged but does not stop a flight.
                </span>
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sort_order">Order in the plan</Label>
              <Input id="sort_order" name="sort_order" type="number" defaultValue={plan.items.length} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Adding..." : "Add item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewPlanDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New plan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              const form = event.currentTarget;
              const result = await createInspectionPlan(new FormData(form));
              setSaving(false);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              form.reset();
              setOpen(false);
              toast.success("Plan created. Add its items next.");
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>New inspection plan</DialogTitle>
              <DialogDescription>
                A named schedule — usually the manufacturer&apos;s, for one aircraft type.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="plan_name">Name</Label>
              <Input id="plan_name" name="name" placeholder="Matrice 350 RTK schedule" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="applies_to_model">Applies to model (optional)</Label>
              <Input id="applies_to_model" name="applies_to_model" placeholder="Matrice 350 RTK" />
              <p className="text-xs text-muted-foreground">
                Every aircraft of this model picks the plan up. Leave blank to assign it aircraft by
                aircraft instead.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="plan_description">Notes (optional)</Label>
              <Textarea id="plan_description" name="description" rows={2} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InspectionPlansPanel({
  plans,
  aircraft,
  canManage,
}: {
  plans: Plan[];
  aircraft: PlanAircraft[];
  canManage: boolean;
}) {
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">
            A plan is a list of items, each on its own clock. Nothing here stores a due date — every
            one is worked out from these intervals and the completions recorded against them, so
            correcting an interval corrects every aircraft&apos;s schedule at once.
          </p>
          {canManage ? <NewPlanDialog /> : null}
        </div>

        {plans.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No plans yet. Start with the manufacturer&apos;s schedule for your most-flown aircraft.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {plans.map((plan) => (
              <li key={plan.id} className="flex flex-col gap-3 rounded-md border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {plan.applies_to_model ? (
                        <Badge variant="secondary">{plan.applies_to_model}</Badge>
                      ) : (
                        <Badge variant="outline">Assigned per aircraft</Badge>
                      )}
                      {plan.active ? null : <Badge variant="outline">Inactive</Badge>}
                    </span>
                    {plan.description ? (
                      <span className="text-sm text-muted-foreground">{plan.description}</span>
                    ) : null}
                  </div>

                  {canManage ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <AddItemDialog plan={plan} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setPlanActive(plan.id, !plan.active);
                            if (result.error) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success(plan.active ? "Plan paused." : "Plan active.");
                          })
                        }
                      >
                        <Power className="size-3.5" />
                        {plan.active ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {plan.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No items yet — this plan schedules nothing until one is added.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-2 font-medium">Item</th>
                          <th className="pb-2 font-medium">Interval</th>
                          {canManage ? <th className="pb-2" /> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {[...plan.items]
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((item) => (
                            <tr key={item.id} className="border-b border-border/60 last:border-0">
                              <td className="py-2 pr-3">
                                <span className="flex flex-wrap items-center gap-2">
                                  {item.name}
                                  {item.is_critical ? (
                                    <Badge variant="outline">Critical</Badge>
                                  ) : null}
                                </span>
                                {item.description ? (
                                  <span className="block text-xs text-muted-foreground">
                                    {item.description}
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                                {intervalSummary(item)}
                              </td>
                              {canManage ? (
                                <td className="py-2 text-right">
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => setRemoving({ id: item.id, name: item.name })}
                                  >
                                    <Trash2 className="size-3" />
                                    Remove
                                  </Button>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {canManage && plan.applies_to_model === null ? (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <span className="text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
                      Aircraft on this plan
                    </span>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {aircraft.map((uav) => (
                        <label key={uav.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={plan.assignedUavIds.includes(uav.id)}
                            onCheckedChange={(checked) =>
                              startTransition(async () => {
                                const result = await setPlanAssignment(
                                  plan.id,
                                  uav.id,
                                  checked === true,
                                );
                                if (result.error) toast.error(result.error);
                              })
                            }
                          />
                          {uav.drone_id}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
        title={`Remove "${removing?.name ?? ""}" from the plan?`}
        description={
          <>
            The item stops being scheduled on every aircraft the plan covers. Maintenance records
            that satisfied it are kept — they simply stop pointing at a plan item.
          </>
        }
        confirmLabel="Remove item"
        destructive
        pending={isPending}
        onConfirm={() =>
          startTransition(async () => {
            if (removing === null) return;
            const result = await deletePlanItem(removing.id);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            setRemoving(null);
            toast.success("Item removed.");
          })
        }
      />
    </>
  );
}
