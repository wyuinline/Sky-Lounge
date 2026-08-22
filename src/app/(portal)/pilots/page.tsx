import { Lock } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { StatusDot } from "@/components/portal/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PilotsTable, type PilotRow } from "@/components/portal/pilots/pilots-table";
import { AddPilotDialog } from "@/components/portal/pilots/add-pilot-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { derivePilotCertificateStatus, recencyDue, deriveExpiryStatus } from "@/lib/compliance";

export default async function PilotsPage() {
  const supabase = await createClient();
  const [profile, { data: pilots }] = await Promise.all([
    getCurrentProfile(),
    // The view derives recency_due and the ROC-A flag, so the page and the
    // reminder scan read the same figures.
    supabase
      .from("pilot_certificate_status")
      .select(
        "id, full_name, certificate_number, certificate_type, certificate_issued, certificate_expires, last_recency_activity, notes, has_roc_a",
      )
      .order("full_name"),
  ]);

  const rows = (pilots ?? []) as PilotRow[];
  const canManagePilots = profile ? ["uav_admin", "ops_manager"].includes(profile.role) : false;

  const now = new Date();
  const certificatesExpiring = rows.filter(
    (r) => deriveExpiryStatus(r.certificate_expires, now) === "due_soon",
  ).length;
  const recencyDueSoon = rows.filter(
    (r) => deriveExpiryStatus(recencyDue(r.last_recency_activity), now) !== "current",
  ).length;
  const notValid = rows.filter(
    (r) => derivePilotCertificateStatus(r.certificate_expires, r.last_recency_activity, now) === "expired",
  ).length;
  const missingRocA = rows.filter((r) => !r.has_roc_a).length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Crew Registry"
        title="Pilots & Crew Management"
        subtitle="RPAS pilot certificates, recency activity, and radio operator credentials."
        actions={canManagePilots ? <AddPilotDialog /> : undefined}
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

      <PilotsTable rows={rows} canManage={canManagePilots} />

      <Alert>
        <Lock />
        <AlertTitle>Restricted data</AlertTitle>
        <AlertDescription>
          Access to pilot records is restricted to authorized personnel (administrators, operations
          managers, and auditors). Pilots can view only their own record. The ROC-A tick reflects a
          certificate actually held on file, not a manual claim.
        </AlertDescription>
      </Alert>
    </div>
  );
}
