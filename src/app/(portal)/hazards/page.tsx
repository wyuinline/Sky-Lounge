import { ShieldAlert } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { SectionLabel } from "@/components/portal/section-label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskMatrix, type MatrixPoint } from "@/components/portal/hazards/risk-matrix";
import { HazardsTable, type HazardRow } from "@/components/portal/hazards/hazards-table";
import {
  AddHazardDialog,
  type HazardCategory,
  type HazardStatus,
  type OwnerOption,
} from "@/components/portal/hazards/hazard-dialog";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { riskBand, type Likelihood, type Severity } from "@/lib/risk";
import { deriveExpiryStatus } from "@/lib/compliance";

export default async function HazardsPage() {
  const supabase = await createClient();
  const [access, hazardsRes, ownersRes] = await Promise.all([
    getAccess(),
    // The view derives both scores and the next review date, so the register,
    // the matrix and any report all read the same numbers.
    supabase
      .from("hazard_register")
      .select(
        "id, hazard_code, title, description, category, initial_likelihood, initial_severity, mitigation, residual_likelihood, residual_severity, owner_id, owner_name, status, identified_on, last_reviewed_at, review_interval_months, notes, initial_score, residual_score, review_due, incident_count, open_finding_count",
      )
      .order("hazard_code"),
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
  ]);

  const canManage = access?.canManage("incidents") ?? false;

  const rows: HazardRow[] = (hazardsRes.data ?? []).map((h) => ({
    id: h.id ?? "",
    hazard_code: h.hazard_code,
    title: h.title,
    description: h.description,
    category: h.category as HazardCategory | null,
    initial_likelihood: h.initial_likelihood as Likelihood | null,
    initial_severity: h.initial_severity as Severity | null,
    mitigation: h.mitigation,
    residual_likelihood: h.residual_likelihood as Likelihood | null,
    residual_severity: h.residual_severity as Severity | null,
    owner_id: h.owner_id,
    owner_name: h.owner_name,
    status: h.status as HazardStatus | null,
    review_interval_months: h.review_interval_months,
    notes: h.notes,
    initial_score: h.initial_score,
    residual_score: h.residual_score,
    review_due: h.review_due,
    incident_count: h.incident_count,
    open_finding_count: h.open_finding_count,
  }));

  const owners: OwnerOption[] = (ownersRes.data ?? []).map((o) => ({
    id: o.id,
    name: o.full_name ?? "Unnamed",
  }));

  const live = rows.filter((r) => r.status !== "closed");

  // The matrix plots residual risk where it has been assessed and inherent
  // risk where it has not — a hazard nobody has re-scored still sits at the
  // risk it started with, and hiding it would flatter the picture.
  const points: MatrixPoint[] = live
    .map((r) => ({
      likelihood: r.residual_likelihood ?? r.initial_likelihood,
      severity: r.residual_severity ?? r.initial_severity,
    }))
    .filter((p): p is MatrixPoint => p.likelihood !== null && p.severity !== null);

  const effective = (r: HazardRow) => r.residual_score ?? r.initial_score;
  const extreme = live.filter((r) => {
    const s = effective(r);
    return s !== null && riskBand(s) === "extreme";
  }).length;
  const unassessed = live.filter((r) => r.residual_score === null).length;
  const now = new Date();
  const reviewOverdue = live.filter(
    (r) => deriveExpiryStatus(r.review_due, now) === "expired",
  ).length;
  const evidenced = live.filter((r) => (r.incident_count ?? 0) > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Safety Management"
        title="Hazard Register"
        subtitle="What could go wrong, how likely and how bad, what is done about it, and what risk remains. The record an operator certificate review asks for."
        actions={canManage ? <AddHazardDialog owners={owners} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Live Hazards" value={`${live.length}`} tone="neutral" />
        <MetricTile
          label="Extreme Risk"
          value={`${extreme}`}
          tone={extreme > 0 ? "critical" : "good"}
        />
        <MetricTile
          label="Residual Not Assessed"
          value={`${unassessed}`}
          tone={unassessed > 0 ? "warning" : "good"}
        />
        <MetricTile
          label="Review Overdue"
          value={`${reviewOverdue}`}
          tone={reviewOverdue > 0 ? "critical" : "good"}
        />
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            Risk matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RiskMatrix
            points={points}
            caption="Live hazards, plotted at their residual risk where it has been assessed and their inherent risk where it has not."
          />
        </CardContent>
      </Card>

      <div>
        <SectionLabel>Register</SectionLabel>
        <HazardsTable rows={rows} owners={owners} canManage={canManage} />
      </div>

      {evidenced > 0 ? (
        <Alert>
          <ShieldAlert />
          <AlertTitle>
            {evidenced} hazard{evidenced === 1 ? " has" : "s have"} been evidenced by an incident
          </AlertTitle>
          <AlertDescription>
            A hazard with incidents recorded against it is one whose controls are not working,
            whatever its residual score says. Those rows are flagged in the register.
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert>
        <ShieldAlert />
        <AlertTitle>How this connects to the rest of the record</AlertTitle>
        <AlertDescription>
          Incidents can be linked to the hazard they evidenced, and an audit finding can name the
          hazard it addresses, the incident that raised it, and the procedure it changed. That trace
          — event to corrective action to revised document to retrained crew — is what a safety
          management audit actually asks to see, and it is why these records live in one portal
          rather than four.
        </AlertDescription>
      </Alert>
    </div>
  );
}
