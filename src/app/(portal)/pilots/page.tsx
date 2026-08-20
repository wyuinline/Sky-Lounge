import { Lock } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { StatusDot } from "@/components/portal/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PilotsTable, type PilotRow } from "@/components/portal/pilots/pilots-table";
import { AddPilotDialog } from "@/components/portal/pilots/add-pilot-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { deriveExpiryStatus } from "@/lib/compliance";

export default async function PilotsPage() {
  const supabase = await createClient();
  const [profile, { data: pilots }] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("pilots")
      .select(
        "id, full_name, employee_id, license_number, medical_expiry, flight_hours, currency_status, training_records(id)",
      )
      .order("full_name")
,
  ]);

  const rows = pilots ?? [];
  const canManagePilots = profile ? ["uav_admin", "ops_manager"].includes(profile.role) : false;

  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const medicalExpiring30 = rows.filter(
    (r) => r.medical_expiry && new Date(r.medical_expiry) >= today && new Date(r.medical_expiry) <= in30Days,
  ).length;
  // Derived from the medical expiry date. currency_status is stored but never
  // maintained, so a pilot with a long-lapsed medical still read as "Current".
  const currencyChanges = rows.filter(
    (r) => deriveExpiryStatus(r.medical_expiry, today) !== "current",
  ).length;
  const trainingRecordsCount = rows.reduce((c, r) => c + r.training_records.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Crew Registry"
        title="Pilots & Crew Management"
        subtitle="Secure pilot database — certifications, medical status, training records, and flight currency tracking."
        actions={canManagePilots ? <AddPilotDialog /> : undefined}
      />

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            Expiry Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between border-b border-border pb-2 text-sm sm:border-b-0 sm:pb-0">
            <StatusDot
              tone={medicalExpiring30 > 0 ? "warning" : "good"}
              label="Medical certs expiring (30 days)"
            />
            <span className="text-sm font-semibold tabular-nums">{medicalExpiring30}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-2 text-sm sm:border-b-0 sm:pb-0">
            <StatusDot tone="neutral" label="Training records on file" />
            <span className="text-sm font-semibold tabular-nums">{trainingRecordsCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <StatusDot tone={currencyChanges > 0 ? "warning" : "good"} label="Currency status changes" />
            <span className="text-sm font-semibold tabular-nums">{currencyChanges}</span>
          </div>
        </CardContent>
      </Card>

      <PilotsTable rows={rows} />

      <Alert>
        <Lock />
        <AlertTitle>Restricted data</AlertTitle>
        <AlertDescription>
          Access to pilot personal data is restricted to authorized personnel (administrators, operations
          managers, and auditors). Pilots can view only their own record. Contact your administrator for
          access requests.
        </AlertDescription>
      </Alert>
    </div>
  );
}
