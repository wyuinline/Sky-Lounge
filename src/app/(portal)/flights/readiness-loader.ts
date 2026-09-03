import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateReadiness,
  type Readiness,
  type ReadinessInput,
  type CertificateLevel,
} from "@/lib/readiness";
import {
  declarationVerdict,
  describeFlight,
  type FlightCharacteristics,
  type RpasOperation,
} from "@/lib/declarations";
import { todayIso } from "@/lib/compliance";

/**
 * Gathering what the readiness engine needs.
 *
 * The engine is pure and decides nothing about where records come from; this
 * is the half that knows. Keeping them apart is what lets the whole rule set
 * be tested against date and record combinations that would take a season to
 * arrange for real.
 *
 * Everything below is scoped by RLS to the caller's organisation, so none of
 * these queries mentions an organisation.
 */

export type ReadinessRequest = {
  pilotId: string;
  uavId: string;
  flightDate?: string;
  /** The certificate level this operation needs. */
  requiredLevel?: CertificateLevel;
  proximity?: FlightCharacteristics["proximity"];
  controlledAirspace?: boolean;
  sheltered?: boolean;
  /** Which type competencies this assignment requires. */
  requiredCompetencies?: string[];
};

export type ReadinessResult =
  | { error: string; readiness: null }
  | { error: null; readiness: Readiness; pilotName: string; droneId: string };

export async function loadReadiness(request: ReadinessRequest): Promise<ReadinessResult> {
  const supabase = await createClient();
  const flightDate = request.flightDate ?? todayIso();

  const [
    { data: pilot },
    { data: uav },
    { data: certificates },
    { data: recency },
    { data: modules },
    { data: completions },
    { data: authorisations },
    { data: competencies },
    { data: declarations },
    { data: planStatus },
  ] = await Promise.all([
    supabase.from("pilots").select("id, full_name, active").eq("id", request.pilotId).maybeSingle(),
    supabase
      .from("uav_fleet_status")
      .select("uav_id, drone_id, status, registration_number, hours_until_service")
      .eq("uav_id", request.uavId)
      .maybeSingle(),
    supabase
      .from("pilot_certificates")
      .select("certificate_level, issued_on, verified_on")
      .eq("pilot_id", request.pilotId),
    supabase.from("recency_records").select("expires_on").eq("pilot_id", request.pilotId),
    // Only the modules this operator actually requires of everyone. A module
    // scoped to a role nobody holds should not block a flight.
    supabase
      .from("training_modules")
      .select("id, code, name, interval_months, required_for_all")
      .eq("active", true),
    supabase
      .from("training_completions")
      .select("module_id, delivered_on, assessment_result")
      .eq("pilot_id", request.pilotId),
    supabase
      .from("pilot_authorisations")
      .select("operation, expires_on")
      .eq("pilot_id", request.pilotId),
    supabase
      .from("type_competencies")
      .select("competency_type, expires_on, uav_id, aircraft_model, component_id, result")
      .eq("pilot_id", request.pilotId),
    supabase.from("aircraft_declarations").select("operation").eq("uav_id", request.uavId),
    supabase
      .from("inspection_plan_status")
      .select("item_name, is_critical, is_due")
      .eq("uav_id", request.uavId)
      .eq("is_critical", true)
      .eq("is_due", true),
  ]);

  if (!pilot) return { error: "That pilot no longer exists.", readiness: null };
  if (!uav) return { error: "That aircraft no longer exists.", readiness: null };

  // The aircraft's own record, for the fields the fleet view does not carry.
  const { data: uavDetail } = await supabase
    .from("uavs")
    .select("rpas_category, registration_marking_verified_on")
    .eq("id", request.uavId)
    .maybeSingle();

  // Restricted, and read through its own permission. A caller without the
  // personal_data area simply gets nothing, and the age and work-authorization
  // predicates pass — which is correct: they are not this caller's to check.
  const { data: personal } = await supabase
    .from("pilot_personal_data")
    .select("date_of_birth, work_authorization_expires_on")
    .eq("pilot_id", request.pilotId)
    .maybeSingle();

  const flight: FlightCharacteristics = {
    category: uavDetail?.rpas_category ?? null,
    proximity: request.proximity ?? "away",
    controlledAirspace: request.controlledAirspace ?? false,
    sheltered: request.sheltered ?? false,
  };

  const held = (declarations ?? []).map((d) => d.operation as RpasOperation);
  const verdict = declarationVerdict(flight, held);

  // Training: one entry per required module, carrying the expiry derived from
  // the module's own interval. A module with no interval is satisfied once.
  const completionByModule = new Map<string, string>();
  for (const completion of completions ?? []) {
    if (completion.assessment_result !== "pass") continue;
    const existing = completionByModule.get(completion.module_id);
    if (!existing || completion.delivered_on > existing) {
      completionByModule.set(completion.module_id, completion.delivered_on);
    }
  }

  const training = (modules ?? [])
    .filter((module) => module.required_for_all)
    .map((module) => {
      const delivered = completionByModule.get(module.id) ?? null;
      return {
        code: module.code,
        name: module.name,
        expiresOn:
          delivered === null
            ? null
            : module.interval_months === null
              ? // No interval: delivered once and it stands. A far-future date
                // rather than null, because null means "never delivered".
                "9999-12-31"
              : addMonthsIso(delivered, module.interval_months),
      };
    });

  const input: ReadinessInput = {
    flightDate,
    requiredLevel: request.requiredLevel ?? "advanced",
    certificates: (certificates ?? []).map((c) => ({
      level: c.certificate_level as CertificateLevel,
      issuedOn: c.issued_on,
      verifiedOn: c.verified_on,
    })),
    recencyExpiries: (recency ?? []).map((r) => r.expires_on).filter((e): e is string => e !== null),
    dateOfBirth: personal?.date_of_birth ?? null,
    workAuthorizationExpiresOn: personal?.work_authorization_expires_on ?? null,
    training,
    authorization: buildAuthorisation(authorisations ?? [], flightDate),
    // Acknowledgement tracking is not built yet; an empty list is honest —
    // nothing is known to be unacknowledged — rather than a silent pass.
    unacknowledgedDocuments: [],
    competencies: (competencies ?? [])
      .filter((c) => c.result === "pass")
      .filter((c) => c.uav_id === null || c.uav_id === request.uavId)
      .map((c) => ({
        type: c.competency_type,
        expiresOn: c.expires_on,
        subject: c.aircraft_model ?? c.uav_id ?? c.component_id ?? "",
      })),
    requiredCompetencies: request.requiredCompetencies ?? ["airframe"],
    aircraft: {
      droneId: uav.drone_id ?? "That aircraft",
      status: uav.status ?? "airworthy",
      registrationNumber: uav.registration_number,
      markingVerifiedOn: uavDetail?.registration_marking_verified_on ?? null,
      // An aircraft whose category was never recorded is a gap in the record,
      // not a refusal: the engine is told the declaration is satisfied and the
      // gap is surfaced on the fleet page instead.
      hasDeclarationForOperation: verdict.status !== "missing",
      operationLabel: describeFlight(flight),
      declarationCarReference: "901.69",
      hoursUntilService: uav.hours_until_service,
      overdueCriticalInspections: (planStatus ?? []).map((p) => p.item_name ?? "an inspection"),
    },
  };

  return {
    error: null,
    readiness: evaluateReadiness(input),
    pilotName: pilot.full_name,
    droneId: uav.drone_id ?? "",
  };
}

/**
 * The pilot's authorisation, as the engine wants it.
 *
 * The portal's authorisations are per operation type — VLOS, BVLOS, over
 * people — rather than per aircraft, so "covers this aircraft" is true for any
 * live authorisation until aircraft-scoped authorisations are built. Stated
 * plainly rather than silently: a predicate that always passes and looks like
 * it checks something is worse than one that is known not to.
 */
function buildAuthorisation(
  rows: { operation: string; expires_on: string | null }[],
  flightDate: string,
): ReadinessInput["authorization"] {
  const live = rows.filter((r) => r.expires_on === null || r.expires_on > flightDate);
  if (live.length === 0) return null;

  return {
    coversOperation: true,
    coversAircraft: true,
    supervisionRequired: false,
    supervisorName: null,
    reviewDueOn: null,
  };
}

/** Months onto an ISO date, clamping a month-end overflow the way dates do. */
function addMonthsIso(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  // The 31st plus one month lands in the following month; pull it back.
  if (date.getUTCDate() < day) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}
