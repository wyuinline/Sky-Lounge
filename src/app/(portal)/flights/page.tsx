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
import { getAccess } from "@/lib/permissions";

const workflowSteps = [
  "Pilot submits flight request with mission details and risk assessment",
  "UAV Lead or Administrator reviews and approves or rejects",
  "Pilot receives approval notification",
  "Mission execution",
  "Post-flight report and flight log submitted",
];

export default async function FlightsPage() {
  const supabase = await createClient();
  const [access, pilotsRes, uavsRes, batteriesRes, requestsRes, logsRes] = await Promise.all([
    getAccess(),
    // Departed crew are not offered: you cannot assign new work to someone
    // who has left, and their record stays only for the history.
    supabase.from("pilots").select("id, full_name").eq("active", true).order("full_name"),
    // Retired airframes likewise — they are kept for their logs, not to fly.
    supabase.from("uavs").select("id, drone_id").neq("status", "retired").order("drone_id"),
    // Retired packs are not offered either — a cycle cannot be added to
    // something that has left service.
    supabase
      .from("batteries")
      .select("id, battery_id")
      .neq("status", "retired")
      .order("battery_id"),
    supabase
      .from("flight_requests")
      .select("id, location, requested_date, risk_level, approval_status, pilots(full_name), uavs(drone_id)")
      .order("created_at", { ascending: false })
,
    supabase
      .from("flight_logs")
      .select(
        "id, flight_date, effective_duration_minutes, weather_conditions, mission_outcome, acknowledged_at, takeoff_at, landing_at, location_name, airspace, is_night, is_bvlos, is_over_people, is_sheltered, sfoc_reference, pilots(full_name), uavs(drone_id)",
      )
      .order("flight_date", { ascending: false })
      .limit(20)
,
  ]);

  const pilotOptions = (pilotsRes.data ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const uavOptions = (uavsRes.data ?? []).map((u) => ({ id: u.id, label: u.drone_id }));
  const batteryOptions = (batteriesRes.data ?? []).map((b) => ({ id: b.id, label: b.battery_id }));
  const canApprove = access?.canManage("requests") ?? false;
  const canReviewLogs = access?.canManage("logs") ?? false;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Mission Control"
        title="Flight Operations Center"
        subtitle="Flight requests, approvals, mission planning, and post-flight reporting — all in one place."
        actions={
          <>
            <LogFlightDialog
              pilots={pilotOptions}
              uavs={uavOptions}
              batteries={batteryOptions}
            />
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
        <FlightLogsTable rows={logsRes.data ?? []} canAcknowledge={canReviewLogs} />
      </div>

      <Alert>
        <Info />
        <AlertTitle>Approval required</AlertTitle>
        <AlertDescription>
          All flight requests require UAV Lead or Administrator approval before mission
          execution.
        </AlertDescription>
      </Alert>
    </div>
  );
}
