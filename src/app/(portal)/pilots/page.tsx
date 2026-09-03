import { Lock } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { StatusDot } from "@/components/portal/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PilotsTable, type PilotRow } from "@/components/portal/pilots/pilots-table";
import { AddPilotDialog } from "@/components/portal/pilots/pilot-dialog";
import { SectionLabel } from "@/components/portal/section-label";
import {
  AuthorisationMatrix,
  type AuthorisationCell,
  type CrewMember,
} from "@/components/portal/pilots/authorisation-matrix";
import type { OperationType } from "@/lib/operations";
import { ImportDialog } from "@/components/portal/import-dialog";
import { pilotImport } from "@/lib/import-schemas";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { derivePilotCertificateStatus, recencyDue, deriveExpiryStatus } from "@/lib/compliance";
import { AttentionSummary } from "@/components/portal/attention-flag";
import { pilotFlags, worstSeverity } from "@/lib/flags";

export default async function PilotsPage() {
  const supabase = await createClient();
  const [access, { data: pilots }, { data: authorisations }] = await Promise.all([
    getAccess(),
    // The view derives recency_due and the ROC-A flag, so the page and the
    // reminder scan read the same figures.
    supabase
      .from("pilot_certificate_status")
      .select(
        "id, full_name, certificate_number, certificate_type, certificate_issued, certificate_expires, last_recency_activity, notes, has_roc_a, active",
      )
      .order("full_name"),
    // currently_valid is derived by the view, so the matrix and the flight
    // request gate agree on whether a clearance has lapsed.
    supabase
      .from("pilot_authorisation_status")
      .select("pilot_id, operation, expires_on, evidence, currently_valid, pilot_active"),
  ]);

  const rows = (pilots ?? []) as PilotRow[];
  const canManagePilots = access?.canManage("pilots") ?? false;

  // Credential alerts describe who can fly. Someone who has left the company
  // is not a compliance problem, and counting them would keep the page red
  // forever over certificates nobody is relying on.
  const crew = rows.filter((r) => r.active);

  const now = new Date();
  const certificatesExpiring = crew.filter(
    (r) => deriveExpiryStatus(r.certificate_expires, now) === "due_soon",
  ).length;
  const recencyDueSoon = crew.filter(
    (r) => deriveExpiryStatus(recencyDue(r.last_recency_activity), now) !== "current",
  ).length;
  const notValid = crew.filter(
    (r) => derivePilotCertificateStatus(r.certificate_expires, r.last_recency_activity, now) === "expired",
  ).length;
  const missingRocA = crew.filter((r) => !r.has_roc_a).length;

  const crewMembers: CrewMember[] = crew.map((p) => ({ id: p.id, name: p.full_name }));
  const authCells: AuthorisationCell[] = (authorisations ?? [])
    .filter((a) => a.pilot_active !== false)
    .map((a) => ({
      pilot_id: a.pilot_id ?? "",
      operation: a.operation as OperationType,
      expires_on: a.expires_on,
      evidence: a.evidence,
      currently_valid: a.currently_valid ?? false,
    }));
  const lapsed = authCells.filter((a) => !a.currently_valid).length;

  // Counted per pilot, not per flag: the question at the top of the page is
  // how many people need attention, not how many problems exist.
  const flagged = crew.map((r) => worstSeverity(pilotFlags(r, now)));
  const overdueCount = flagged.filter((s) => s === "overdue").length;
  const attentionCount = flagged.filter((s) => s === "attention").length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Crew Registry"
        title="Pilots & Crew Management"
        subtitle="RPAS pilot certificates, recency activity, and radio operator credentials."
        actions={
          canManagePilots ? (
            <>
              <AddPilotDialog />
              <ImportDialog
                schema={pilotImport}
                canManage={canManagePilots}
                buttonLabel="Import crew"
              />
            </>
          ) : undefined
        }
      />

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            Credential Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="flex items-center justify-between border-b border-border pb-2 text-sm sm:border-b-0 sm:pb-0">
            <StatusDot tone={notValid > 0 ? "critical" : "good"} label="Not valid to fly" />
            <span className="text-sm font-semibold tabular-nums">{notValid}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-2 text-sm sm:border-b-0 sm:pb-0">
            <StatusDot
              tone={certificatesExpiring > 0 ? "warning" : "good"}
              label="Certificates expiring"
            />
            <span className="text-sm font-semibold tabular-nums">{certificatesExpiring}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-2 text-sm sm:border-b-0 sm:pb-0">
            <StatusDot tone={recencyDueSoon > 0 ? "warning" : "good"} label="Recency due" />
            <span className="text-sm font-semibold tabular-nums">{recencyDueSoon}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <StatusDot tone={missingRocA > 0 ? "warning" : "good"} label="ROC-A not on file" />
            <span className="text-sm font-semibold tabular-nums">{missingRocA}</span>
          </div>
        </CardContent>
      </Card>

      <AttentionSummary overdue={overdueCount} attention={attentionCount} noun="crew" />

      <PilotsTable rows={rows} canManage={canManagePilots} />

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
          <SectionLabel>Operational Authorisations</SectionLabel>
          {lapsed > 0 ? (
            <span className="text-xs text-[var(--status-critical)]">
              {lapsed} authorisation{lapsed === 1 ? " has" : "s have"} lapsed
            </span>
          ) : null}
        </div>
        <AuthorisationMatrix
          crew={crewMembers}
          authorisations={authCells}
          canManage={canManagePilots}
        />
        <p className="pt-2 text-xs text-muted-foreground">
          A current certificate says a pilot may fly; an authorisation says what they may fly.
          Flight requests are checked against this before they are accepted and again before they
          are approved, since a clearance can lapse while a request waits in the queue.
        </p>
      </div>

      <Alert>
        <Lock />
        <AlertTitle>Restricted data</AlertTitle>
        <AlertDescription>
          Who can see pilot records is set by the &ldquo;Pilots &amp; crew&rdquo; row of the access
          matrix; a pilot given &ldquo;own record&rdquo; sees only themselves. The ROC-A tick
          reflects a certificate actually held on file, not a manual claim.
        </AlertDescription>
      </Alert>
    </div>
  );
}
