import { HeroBand } from "@/components/portal/hero-band";
import { SectionLabel } from "@/components/portal/section-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { FlightRequestsTable, type FlightRequestRow } from "@/components/portal/flights/flight-requests-table";
import { FlightLogsTable, type FlightLogRow } from "@/components/portal/flights/flight-logs-table";
import { SubmitFlightRequestDialog } from "@/components/portal/flights/submit-flight-request-dialog";
import { LogFlightDialog } from "@/components/portal/flights/log-flight-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

const workflowSteps = [
  "Pilot submits flight request with mission details and risk assessment",
  "Operations Manager reviews and approves or rejects",
  "Pilot receives approval notification",
  "Mission execution",
  "Post-flight report and flight log submitted",
];

export default async function FlightsPage() {
  const supabase = await createClient();
  const [profile, pilotsRes, uavsRes, requestsRes, logsRes] = await Promise.all([
    getCurrentProfile(),
    supabase.from("pilots").select("id, full_name").order("full_name"),
    supabase.from("uavs").select("id, drone_id").order("drone_id"),
    supabase
      .from("flight_requests")
      .select("id, location, requested_date, risk_level, approval_status, pilots(full_name), uavs(drone_id)")
      .order("created_at", { ascending: false })
,
    supabase
      .from("flight_logs")
      .select("id, flight_date, duration_minutes, weather_conditions, mission_outcome, pilots(full_name), uavs(drone_id)")
      .order("flight_date", { ascending: false })
      .limit(20)
,
  ]);

  const pilotOptions = (pilotsRes.data ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const uavOptions = (uavsRes.data ?? []).map((u) => ({ id: u.id, label: u.drone_id }));
  const canApprove = profile ? ["uav_admin", "ops_manager"].includes(profile.role) : false;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Mission Control"
        title="Flight Operations Center"
        subtitle="Flight requests, approvals, mission planning, and post-flight reporting — all in one place."
        actions={
          <>
            <LogFlightDialog pilots={pilotOptions} uavs={uavOptions} />
            <SubmitFlightRequestDialog pilots={pilotOptions} uavs={uavOptions} />
          </>
        }
      />

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            Flight Request Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-4">
            {workflowSteps.map((step, i) => (
              <li key={step} className="flex items-start gap-2 sm:flex-1 sm:min-w-48">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div>
        <SectionLabel>Active Flight Requests</SectionLabel>
        <FlightRequestsTable rows={requestsRes.data ?? []} canApprove={canApprove} />
      </div>

      <div>
        <SectionLabel>Flight Logs</SectionLabel>
        <FlightLogsTable rows={logsRes.data ?? []} />
      </div>

      <Alert>
        <Info />
        <AlertTitle>Approval required</AlertTitle>
        <AlertDescription>
          All flight requests require Operations Manager or Administrator approval before mission
          execution.
        </AlertDescription>
      </Alert>
    </div>
  );
}
