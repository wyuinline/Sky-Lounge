import { Clock, ShieldAlert, GraduationCap, Lock } from "lucide-react";
import { PageHero } from "@/components/portal/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PilotsTable, type PilotRow } from "@/components/portal/pilots/pilots-table";
import { AddPilotDialog } from "@/components/portal/pilots/add-pilot-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

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
      .returns<PilotRow[]>(),
  ]);

  const rows = pilots ?? [];
  const canManagePilots = profile ? ["uav_admin", "ops_manager"].includes(profile.role) : false;

  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  const medicalExpiring30 = rows.filter(
    (r) => r.medical_expiry && new Date(r.medical_expiry) >= today && new Date(r.medical_expiry) <= in30Days,
  ).length;
  const currencyChanges = rows.filter((r) => r.currency_status !== "current").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        title="Pilots & Crew Management"
        subtitle="Secure pilot database — certifications, medical status, training records, and flight currency tracking."
        actions={canManagePilots ? <AddPilotDialog /> : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expiry Alerts</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" /> Medical certs expiring (30 days)
            </span>
            <Badge variant={medicalExpiring30 > 0 ? "destructive" : "secondary"}>{medicalExpiring30}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <GraduationCap className="size-4 text-muted-foreground" /> Training records on file
            </span>
            <Badge variant="secondary">{rows.reduce((c, r) => c + r.training_records.length, 0)}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-muted-foreground" /> Currency status changes
            </span>
            <Badge variant={currencyChanges > 0 ? "destructive" : "secondary"}>{currencyChanges}</Badge>
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
