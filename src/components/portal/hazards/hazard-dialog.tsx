"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bandStyle } from "@/components/portal/hazards/risk-matrix";
import {
  likelihoodOrder,
  severityOrder,
  likelihoodLabel,
  severityLabel,
  likelihoodDescription,
  severityDescription,
  riskScore,
  riskBand,
  bandLabel,
  bandGuidance,
  mitigationEffect,
  type Likelihood,
  type Severity,
} from "@/lib/risk";
import { addHazard, updateHazard } from "@/app/(portal)/hazards/actions";

export type HazardCategory =
  | "operational" | "technical" | "environmental"
  | "human_factors" | "regulatory" | "security";

export type HazardStatus = "open" | "mitigated" | "accepted" | "closed";

export const hazardCategoryLabel: Record<HazardCategory, string> = {
  operational: "Operational",
  technical: "Technical",
  environmental: "Environmental",
  human_factors: "Human factors",
  regulatory: "Regulatory",
  security: "Security",
};

export const hazardStatusLabel: Record<HazardStatus, string> = {
  open: "Open",
  mitigated: "Mitigated",
  accepted: "Accepted",
  closed: "Closed",
};

export type OwnerOption = { id: string; name: string };

export type HazardFormValues = {
  id: string;
  hazard_code: string | null;
  title: string | null;
  description: string | null;
  category: HazardCategory | null;
  initial_likelihood: Likelihood | null;
  initial_severity: Severity | null;
  mitigation: string | null;
  residual_likelihood: Likelihood | null;
  residual_severity: Severity | null;
  owner_id: string | null;
  status: HazardStatus | null;
  review_interval_months: number | null;
  notes: string | null;
};

const NO_OWNER = "__none__";
const NOT_ASSESSED = "__unassessed__";

/** Shows the score and band as the two selects are moved. */
function ScorePreview({
  likelihood,
  severity,
  label,
}: {
  likelihood: Likelihood | null;
  severity: Severity | null;
  label: string;
}) {
  if (!likelihood || !severity) {
    return (
      <p className="text-xs text-muted-foreground">
        {label}: not yet assessed.
      </p>
    );
  }
  const score = riskScore(likelihood, severity);
  const band = riskBand(score);
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span
        className={cn(
          "rounded-sm border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase",
          bandStyle[band],
        )}
      >
        {bandLabel[band]} · {score}
      </span>
      <span className="text-muted-foreground">{bandGuidance[band]}</span>
    </p>
  );
}

function HazardForm({
  initial,
  owners,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  initial?: HazardFormValues;
  owners: OwnerOption[];
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [category, setCategory] = useState<HazardCategory>(initial?.category ?? "operational");
  const [status, setStatus] = useState<HazardStatus>(initial?.status ?? "open");
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? NO_OWNER);
  const [iLikelihood, setILikelihood] = useState<Likelihood>(
    initial?.initial_likelihood ?? "possible",
  );
  const [iSeverity, setISeverity] = useState<Severity>(initial?.initial_severity ?? "moderate");
  const [rLikelihood, setRLikelihood] = useState<string>(
    initial?.residual_likelihood ?? NOT_ASSESSED,
  );
  const [rSeverity, setRSeverity] = useState<string>(initial?.residual_severity ?? NOT_ASSESSED);
  const [loading, setLoading] = useState(false);

  const residualAssessed = rLikelihood !== NOT_ASSESSED && rSeverity !== NOT_ASSESSED;
  const initialScore = riskScore(iLikelihood, iSeverity);
  const residualScore = residualAssessed
    ? riskScore(rLikelihood as Likelihood, rSeverity as Severity)
    : null;
  const effect = mitigationEffect(initialScore, residualScore);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    formData.set("category", category);
    formData.set("status", status);
    formData.set("owner_id", ownerId === NO_OWNER ? "" : ownerId);
    formData.set("initial_likelihood", iLikelihood);
    formData.set("initial_severity", iSeverity);
    formData.set("residual_likelihood", residualAssessed ? rLikelihood : "");
    formData.set("residual_severity", residualAssessed ? rSeverity : "");
    const result = await onSubmit(formData);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="hazard_code">Reference</Label>
          <Input
            id="hazard_code"
            name="hazard_code"
            required
            placeholder="HAZ-012"
            defaultValue={initial?.hazard_code ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => v && setCategory(v as HazardCategory)}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v) => hazardCategoryLabel[v as HazardCategory]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(hazardCategoryLabel) as HazardCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {hazardCategoryLabel[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v as HazardStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v) => hazardStatusLabel[v as HazardStatus]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(hazardStatusLabel) as HazardStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {hazardStatusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Hazard</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="Loss of link over the pit wall"
          defaultValue={initial?.title ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">What could happen</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="The circumstances, and what the consequence would be."
          defaultValue={initial?.description ?? ""}
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
          Inherent risk — before controls
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Likelihood</Label>
            <Select value={iLikelihood} onValueChange={(v) => v && setILikelihood(v as Likelihood)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v) => likelihoodLabel[v as Likelihood]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {likelihoodOrder.map((l) => (
                  <SelectItem key={l} value={l}>
                    {likelihoodLabel[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{likelihoodDescription[iLikelihood]}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Severity</Label>
            <Select value={iSeverity} onValueChange={(v) => v && setISeverity(v as Severity)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v) => severityLabel[v as Severity]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {severityOrder.map((s) => (
                  <SelectItem key={s} value={s}>
                    {severityLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{severityDescription[iSeverity]}</p>
          </div>
        </div>
        <ScorePreview likelihood={iLikelihood} severity={iSeverity} label="Inherent" />
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mitigation">Controls</Label>
        <Textarea
          id="mitigation"
          name="mitigation"
          placeholder="What is done about it, and who does it."
          defaultValue={initial?.mitigation ?? ""}
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
          Residual risk — with controls working
        </legend>
        <p className="text-xs text-muted-foreground">
          Leave unassessed until someone has actually judged it. A blank is honest; copying the
          inherent score down is not.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Likelihood</Label>
            <Select value={rLikelihood} onValueChange={(v) => v && setRLikelihood(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) =>
                    v === NOT_ASSESSED ? "Not yet assessed" : likelihoodLabel[v as Likelihood]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOT_ASSESSED}>Not yet assessed</SelectItem>
                {likelihoodOrder.map((l) => (
                  <SelectItem key={l} value={l}>
                    {likelihoodLabel[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Severity</Label>
            <Select value={rSeverity} onValueChange={(v) => v && setRSeverity(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) => (v === NOT_ASSESSED ? "Not yet assessed" : severityLabel[v as Severity])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOT_ASSESSED}>Not yet assessed</SelectItem>
                {severityOrder.map((s) => (
                  <SelectItem key={s} value={s}>
                    {severityLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ScorePreview
          likelihood={residualAssessed ? (rLikelihood as Likelihood) : null}
          severity={residualAssessed ? (rSeverity as Severity) : null}
          label="Residual"
        />
        {effect ? (
          <p className="text-xs text-muted-foreground">
            {effect.direction === "reduced"
              ? `Controls reduce the score by ${effect.delta}.`
              : effect.direction === "increased"
                ? `The residual score is ${effect.delta} higher than the inherent one — check the assessment.`
                : "Controls do not change the score. Worth saying why in the notes."}
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Owner</Label>
          <Select value={ownerId} onValueChange={(v) => v && setOwnerId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) =>
                  v === NO_OWNER ? "Unassigned" : (owners.find((o) => o.id === v)?.name ?? "Unassigned")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_OWNER}>Unassigned</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="review_interval_months">Review every (months)</Label>
          <Input
            id="review_interval_months"
            name="review_interval_months"
            type="number"
            min="1"
            step="1"
            defaultValue={initial?.review_interval_months ?? 12}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddHazardDialog({ owners }: { owners: OwnerOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="size-4" />
          Record Hazard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record a hazard</DialogTitle>
          <DialogDescription>
            What could go wrong, how likely and how bad, what is done about it, and what risk
            remains.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <HazardForm
            owners={owners}
            submitLabel="Record hazard"
            pendingLabel="Recording..."
            onSubmit={async (formData) => {
              const result = await addHazard(formData);
              if (!result.error) {
                toast.success("Hazard recorded.");
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

export function EditHazardDialog({
  hazard,
  owners,
  open,
  onOpenChange,
}: {
  hazard: HazardFormValues | null;
  owners: OwnerOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {hazard?.hazard_code ?? "hazard"}</DialogTitle>
        </DialogHeader>
        {hazard ? (
          <HazardForm
            key={hazard.id}
            initial={hazard}
            owners={owners}
            submitLabel="Save changes"
            pendingLabel="Saving..."
            onSubmit={async (formData) => {
              const result = await updateHazard(hazard.id, formData);
              if (!result.error) {
                toast.success(`${formData.get("hazard_code")} updated.`);
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
