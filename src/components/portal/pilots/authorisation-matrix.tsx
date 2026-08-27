"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import {
  operationOrder,
  operationLabel,
  operationShort,
  operationDescription,
  type OperationType,
} from "@/lib/operations";
import { grantAuthorisation, revokeAuthorisation } from "@/app/(portal)/pilots/authorisation-actions";

export type AuthorisationCell = {
  pilot_id: string;
  operation: OperationType;
  expires_on: string | null;
  evidence: string | null;
  currently_valid: boolean;
};

export type CrewMember = { id: string; name: string };

type Target = { pilot: CrewMember; operation: OperationType; existing: AuthorisationCell | null };

/**
 * Who is cleared for what, as a grid.
 *
 * The same shape as the portal's role permission matrix, deliberately: one is
 * what a role may do in the software, the other what a pilot may do in the
 * air, and an operator reading one should recognise the other immediately.
 */
export function AuthorisationMatrix({
  crew,
  authorisations,
  canManage,
}: {
  crew: CrewMember[];
  authorisations: AuthorisationCell[];
  canManage: boolean;
}) {
  const [granting, setGranting] = useState<Target | null>(null);
  const [revoking, setRevoking] = useState<Target | null>(null);
  const [isPending, startTransition] = useTransition();

  const cellFor = (pilotId: string, operation: OperationType) =>
    authorisations.find((a) => a.pilot_id === pilotId && a.operation === operation) ?? null;

  if (crew.length === 0) {
    return (
      <p className="rounded-md border border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No active crew to authorise yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-muted/50 px-3 py-2.5 text-left text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase"
              >
                Pilot
              </th>
              {operationOrder.map((op) => (
                <th
                  key={op}
                  scope="col"
                  title={operationDescription[op]}
                  className="px-2 py-2.5 text-center text-[0.65rem] font-semibold tracking-[0.04em] text-brand-teal uppercase"
                >
                  {operationShort[op]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crew.map((pilot) => (
              <tr key={pilot.id} className="border-t border-border">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-background px-3 py-2 text-left text-sm font-medium whitespace-nowrap"
                >
                  {pilot.name}
                </th>
                {operationOrder.map((op) => {
                  const cell = cellFor(pilot.id, op);
                  const label = cell
                    ? cell.currently_valid
                      ? `${pilot.name} is authorised for ${operationLabel[op]}${cell.expires_on ? `, until ${cell.expires_on}` : ""}`
                      : `${pilot.name}'s authorisation for ${operationLabel[op]} lapsed on ${cell.expires_on}`
                    : `${pilot.name} is not authorised for ${operationLabel[op]}`;

                  return (
                    <td key={op} className="p-1 text-center">
                      <button
                        type="button"
                        disabled={!canManage}
                        aria-label={label}
                        title={cell?.evidence ? `${label} — ${cell.evidence}` : label}
                        onClick={() =>
                          canManage &&
                          (cell
                            ? setRevoking({ pilot, operation: op, existing: cell })
                            : setGranting({ pilot, operation: op, existing: null }))
                        }
                        className={cn(
                          "flex h-9 w-full items-center justify-center rounded-md border text-xs transition-colors",
                          canManage ? "cursor-pointer hover:brightness-105" : "cursor-default",
                          cell?.currently_valid &&
                            "border-[var(--status-good)]/40 bg-[var(--status-good)]/12 text-[var(--status-good)]",
                          cell &&
                            !cell.currently_valid &&
                            "border-[var(--status-critical)]/45 bg-[var(--status-critical)]/12 text-[var(--status-critical)]",
                          !cell && "border-dashed border-border text-muted-foreground/40",
                        )}
                      >
                        {cell ? (
                          cell.currently_valid ? (
                            <Check className="size-4" />
                          ) : (
                            <X className="size-4" />
                          )
                        ) : (
                          "—"
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Check className="size-3.5 text-[var(--status-good)]" />
          <dd>Authorised</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <X className="size-3.5 text-[var(--status-critical)]" />
          <dd>Lapsed — a date passed, not a decision</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <span aria-hidden>—</span>
          <dd>Not authorised</dd>
        </div>
        {canManage ? <dd>Click a cell to grant or withdraw.</dd> : null}
      </dl>

      {/* Grant */}
      <Dialog open={granting !== null} onOpenChange={(o) => !o && setGranting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Authorise {granting?.pilot.name} for{" "}
              {granting ? operationLabel[granting.operation] : ""}
            </DialogTitle>
            <DialogDescription>
              {granting ? operationDescription[granting.operation] : ""}
            </DialogDescription>
          </DialogHeader>
          {granting ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const evidence = String(data.get("evidence") ?? "");
                const expires = String(data.get("expires_on") ?? "");
                startTransition(async () => {
                  const result = await grantAuthorisation(
                    granting.pilot.id,
                    granting.operation,
                    evidence,
                    expires,
                  );
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(
                    `${granting.pilot.name} authorised for ${operationLabel[granting.operation]}.`,
                  );
                  setGranting(null);
                });
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="evidence">Evidence</Label>
                <Input
                  id="evidence"
                  name="evidence"
                  required
                  placeholder="Level 1 Complex certificate, check ride 2026-03-14, SFOC 2026-0087"
                />
                <p className="text-xs text-muted-foreground">
                  What backs this. An authorisation with nothing behind it is an opinion.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="expires_on">Valid until</Label>
                <Input id="expires_on" name="expires_on" type="date" />
                <p className="text-xs text-muted-foreground">
                  Leave blank if it does not lapse on its own. Certificate and recency are checked
                  separately either way.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  <Plus className="size-4" />
                  {isPending ? "Authorising..." : "Authorise"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Withdraw */}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={
          revoking
            ? `Withdraw ${revoking.pilot.name}'s ${operationLabel[revoking.operation]} authorisation?`
            : ""
        }
        description={
          <>
            They will be refused on new flight requests needing it. Flights already flown are
            untouched — this governs what may be booked from now on.
            {revoking?.existing?.evidence ? (
              <>
                {" "}
                Current evidence: {revoking.existing.evidence}.
              </>
            ) : null}
          </>
        }
        confirmLabel="Withdraw authorisation"
        destructive
        pending={isPending}
        onConfirm={() => {
          if (!revoking) return;
          startTransition(async () => {
            const result = await revokeAuthorisation(revoking.pilot.id, revoking.operation);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(`Authorisation withdrawn from ${revoking.pilot.name}.`);
            setRevoking(null);
          });
        }}
      />
    </div>
  );
}
