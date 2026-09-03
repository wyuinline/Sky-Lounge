/**
 * Flight readiness under CARs Part IX.
 *
 * The single most important rule in the module, from the compliance plan: a
 * certificate is not a competency. Three independent gates must all pass for
 * the *specific* aircraft and operation being flown.
 *
 *   Gate A — Transport Canada credential: the certificate, and recency, which
 *            is the thing that actually lapses.
 *   Gate B — company authorization: the operator's own training programme
 *            under CAR 901.219, and a signed authorization to operate.
 *   Gate C — type competency: this airframe, this payload, this ground station.
 *
 * Every predicate returns why it failed, which CAR requires it, and where to
 * go and fix it. A gate that only says "not ready" sends someone hunting
 * through six screens, and the next thing they learn is to ignore it.
 *
 * Pure, and given every input explicitly. The caller loads the records; this
 * decides. That separation is what lets the whole rule set be tested against
 * dates and combinations that would take a season to reproduce for real.
 */

export type Gate = "A" | "B" | "C" | "aircraft";

export type Verdict = {
  predicate: string;
  gate: Gate;
  pass: boolean;
  /** Present when it fails. Written to be read by the person who is blocked. */
  reason: string | null;
  carReference: string | null;
  /** Where to go to fix it. */
  remediation: string | null;
  /**
   * A failure that stops the flight, versus one that qualifies it. Supervision
   * required is real and must be visible, but it is not a refusal.
   */
  severity: "blocking" | "advisory";
};

export type ReadinessInput = {
  /** The date the flight is planned for, ISO. */
  flightDate: string;

  // --- Gate A -------------------------------------------------------------
  /** The level this operation needs. */
  requiredLevel: CertificateLevel;
  certificates: { level: CertificateLevel; issuedOn: string; verifiedOn: string | null }[];
  /** Every recency record's expiry, ISO. The latest one is what counts. */
  recencyExpiries: string[];
  /** Null when the operator chose not to hold dates of birth. */
  dateOfBirth: string | null;

  // --- Work authorization -------------------------------------------------
  /** Null when not tracked, or the person is a citizen or permanent resident. */
  workAuthorizationExpiresOn: string | null;

  // --- Gate B -------------------------------------------------------------
  /** Company training: one entry per module the operator requires. */
  training: { code: string; name: string; expiresOn: string | null }[];
  /** A non-revoked authorization covering this aircraft and operation. */
  authorization: {
    coversOperation: boolean;
    coversAircraft: boolean;
    supervisionRequired: boolean;
    supervisorName: string | null;
    reviewDueOn: string | null;
  } | null;
  /** Documents whose current version this pilot has not acknowledged. */
  unacknowledgedDocuments: string[];

  // --- Gate C -------------------------------------------------------------
  competencies: { type: string; expiresOn: string | null; subject: string }[];
  /** The competencies this assignment needs, by type. */
  requiredCompetencies: string[];

  // --- The aircraft -------------------------------------------------------
  aircraft: {
    droneId: string;
    status: string;
    registrationNumber: string | null;
    markingVerifiedOn: string | null;
    /** True when a declaration covering the planned operation is on file. */
    hasDeclarationForOperation: boolean;
    /** What that operation is called, for the message. */
    operationLabel: string;
    declarationCarReference: string;
    hoursUntilService: number | null;
    overdueCriticalInspections: string[];
  };
};

export type CertificateLevel = "basic" | "advanced" | "level_1_complex";

/** Ordered by privilege: a higher certificate satisfies a lower requirement. */
export const certificateOrder: CertificateLevel[] = ["basic", "advanced", "level_1_complex"];

export const certificateLevelLabel: Record<CertificateLevel, string> = {
  basic: "Basic operations",
  advanced: "Advanced operations",
  level_1_complex: "Level 1 Complex",
};

/** The minimum age at certificate issuance, by level. */
export const MINIMUM_AGE: Record<CertificateLevel, number> = {
  basic: 14,
  advanced: 16,
  level_1_complex: 18,
};

function pass(predicate: string, gate: Gate): Verdict {
  return { predicate, gate, pass: true, reason: null, carReference: null, remediation: null, severity: "blocking" };
}

function fail(
  predicate: string,
  gate: Gate,
  reason: string,
  carReference: string | null,
  remediation: string | null,
  severity: Verdict["severity"] = "blocking",
): Verdict {
  return { predicate, gate, pass: false, reason, carReference, remediation, severity };
}

/** Whole years between two ISO dates, which is how an age gate is counted. */
export function ageOn(dateOfBirth: string, on: string): number {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const at = new Date(`${on}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return Number.NaN;

  let years = at.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < birth.getUTCDate())) years--;
  return years;
}

/** Whether a held level satisfies a required one. */
export function levelSatisfies(held: CertificateLevel, required: CertificateLevel): boolean {
  return certificateOrder.indexOf(held) >= certificateOrder.indexOf(required);
}

// ---------------------------------------------------------------------------
// The predicates
// ---------------------------------------------------------------------------

function certificateOk(input: ReadinessInput): Verdict {
  const required = certificateLevelLabel[input.requiredLevel];
  const held = input.certificates.filter((c) => levelSatisfies(c.level, input.requiredLevel));

  if (held.length === 0) {
    return fail(
      "certificate",
      "A",
      `No ${required} certificate on file. This operation needs one.`,
      "901.55 / 901.64 / 901.90",
      "Add the certificate on the pilot's record",
    );
  }

  // Recorded but never checked against the Drone Management Portal. Not a
  // refusal — the certificate may well be genuine — but an operator who has
  // never verified one has a gap an inspector will find.
  if (held.every((c) => c.verifiedOn === null)) {
    return fail(
      "certificate",
      "A",
      `The ${required} certificate has not been verified as genuine.`,
      "901.55 / 901.64 / 901.90",
      "Verify the certificate against the Drone Management Portal",
      "advisory",
    );
  }

  return pass("certificate", "A");
}

function recencyOk(input: ReadinessInput): Verdict {
  if (input.recencyExpiries.length === 0) {
    return fail(
      "recency",
      "A",
      "No recency activity on file. A pilot must have completed a recency activity within the last 24 months.",
      "901.56 / 901.65 / 901.91",
      "Record a recency activity on the pilot's record",
    );
  }

  // The latest one is what counts; earlier records are history, not a top-up.
  const latest = input.recencyExpiries.reduce((a, b) => (b > a ? b : a));
  if (latest <= input.flightDate) {
    return fail(
      "recency",
      "A",
      `Recency lapsed on ${latest}. A pilot may not fly without a current recency activity.`,
      "901.56 / 901.65 / 901.91",
      "Record a new recency activity — an exam retake, flight review, TC-endorsed seminar, recurrent training or the self-paced study questionnaire",
    );
  }

  return pass("recency", "A");
}

function ageOk(input: ReadinessInput): Verdict {
  // Not tracked is not a failure: an operator may deliberately hold no dates
  // of birth and check the age gate by hand at certificate application.
  if (input.dateOfBirth === null) return pass("age", "A");

  const minimum = MINIMUM_AGE[input.requiredLevel];
  const age = ageOn(input.dateOfBirth, input.flightDate);
  if (Number.isNaN(age)) return pass("age", "A");

  if (age < minimum) {
    return fail(
      "age",
      "A",
      `${certificateLevelLabel[input.requiredLevel]} requires a minimum age of ${minimum}.`,
      "901.55 / 901.64 / 901.90",
      "Check the certificate level this operation is assigned at",
    );
  }
  return pass("age", "A");
}

function workAuthorizationOk(input: ReadinessInput): Verdict {
  if (input.workAuthorizationExpiresOn === null) return pass("work_authorization", "A");

  if (input.workAuthorizationExpiresOn <= input.flightDate) {
    return fail(
      "work_authorization",
      "A",
      `Work authorization expired on ${input.workAuthorizationExpiresOn}.`,
      // Deliberately not a CAR: this is an IRCC matter, and labelling it as a
      // Transport Canada requirement would be wrong in a document an inspector
      // reads.
      null,
      "An immigration matter, not a Transport Canada one — check with HR before assigning",
    );
  }
  return pass("work_authorization", "A");
}

function trainingOk(input: ReadinessInput): Verdict {
  const missing = input.training.filter((t) => t.expiresOn === null);
  const lapsed = input.training.filter(
    (t) => t.expiresOn !== null && t.expiresOn <= input.flightDate,
  );

  if (missing.length > 0) {
    return fail(
      "company_training",
      "B",
      `Company training not completed: ${missing.map((t) => t.name).join(", ")}.`,
      "901.219",
      "Record the training on the pilot's record",
    );
  }
  if (lapsed.length > 0) {
    return fail(
      "company_training",
      "B",
      `Company training lapsed: ${lapsed.map((t) => `${t.name} (${t.expiresOn})`).join(", ")}.`,
      "901.219",
      "Deliver the recurrent training and record it",
    );
  }
  return pass("company_training", "B");
}

function authorizationOk(input: ReadinessInput): Verdict {
  const authorization = input.authorization;

  if (authorization === null) {
    return fail(
      "company_authorization",
      "B",
      "No company authorization on file for this pilot.",
      "901.219",
      "Issue an RPAS pilot authorization",
    );
  }
  if (!authorization.coversOperation) {
    return fail(
      "company_authorization",
      "B",
      "The pilot's authorization does not cover this kind of operation.",
      "901.219",
      "Amend the authorization to include this operation",
    );
  }
  if (!authorization.coversAircraft) {
    return fail(
      "company_authorization",
      "B",
      `The pilot's authorization does not cover ${input.aircraft.droneId}.`,
      "901.219",
      "Amend the authorization to include this aircraft",
    );
  }

  // Supervision is a condition on the flight, not a refusal of it — the plan
  // is explicit that it surfaces as a named warning.
  if (authorization.supervisionRequired) {
    return fail(
      "company_authorization",
      "B",
      authorization.supervisorName
        ? `Supervised operation: ${authorization.supervisorName} must supervise this flight.`
        : "Supervised operation: a supervisor must be named on this flight.",
      "901.219",
      "Assign the named supervisor to the flight",
      "advisory",
    );
  }

  return pass("company_authorization", "B");
}

function documentsOk(input: ReadinessInput): Verdict {
  if (input.unacknowledgedDocuments.length === 0) return pass("documents", "B");

  return fail(
    "documents",
    "B",
    `Current versions not acknowledged: ${input.unacknowledgedDocuments.join(", ")}.`,
    "901.217",
    "Acknowledge the current versions on the documents page",
    "advisory",
  );
}

function competencyOk(input: ReadinessInput): Verdict {
  const missing: string[] = [];
  const lapsed: string[] = [];

  for (const required of input.requiredCompetencies) {
    const held = input.competencies.filter((c) => c.type === required);
    if (held.length === 0) {
      missing.push(required.replace(/_/g, " "));
      continue;
    }
    // Any unexpired sign-off of that type will do.
    const current = held.some((c) => c.expiresOn === null || c.expiresOn > input.flightDate);
    if (!current) lapsed.push(required.replace(/_/g, " "));
  }

  if (missing.length > 0) {
    return fail(
      "type_competency",
      "C",
      `No competency assessment on file for: ${missing.join(", ")}.`,
      "901.219",
      "Record a type competency assessment",
    );
  }
  if (lapsed.length > 0) {
    return fail(
      "type_competency",
      "C",
      `Competency assessment lapsed for: ${lapsed.join(", ")}.`,
      "901.219",
      "Reassess the pilot on this type",
    );
  }
  return pass("type_competency", "C");
}

function registrationOk(input: ReadinessInput): Verdict {
  const { droneId, registrationNumber, markingVerifiedOn } = input.aircraft;

  if (!registrationNumber) {
    return fail(
      "registration",
      "aircraft",
      `${droneId} has no registration number recorded.`,
      "901.02",
      "Register the aircraft with Transport Canada and record the number",
    );
  }
  if (markingVerifiedOn === null) {
    // The marking must be affixed and legible, not merely allocated. Advisory
    // because the aircraft is registered; someone just has to go and look.
    return fail(
      "registration",
      "aircraft",
      `${droneId} is registered, but the marking has not been verified as affixed and legible.`,
      "901.03",
      "Check the marking on the airframe and record the date",
      "advisory",
    );
  }
  return pass("registration", "aircraft");
}

function declarationOk(input: ReadinessInput): Verdict {
  if (input.aircraft.hasDeclarationForOperation) return pass("declaration", "aircraft");

  return fail(
    "declaration",
    "aircraft",
    `${input.aircraft.droneId} has no manufacturer safety-assurance declaration for ${input.aircraft.operationLabel}.`,
    input.aircraft.declarationCarReference,
    "Record the manufacturer's declaration for this operation on the aircraft",
  );
}

function serviceableOk(input: ReadinessInput): Verdict {
  const { droneId, status, hoursUntilService, overdueCriticalInspections } = input.aircraft;

  if (status === "retired") {
    return fail("serviceable", "aircraft", `${droneId} has been retired from the fleet.`, null, null);
  }
  if (status === "grounded") {
    return fail("serviceable", "aircraft", `${droneId} is grounded.`, "901.29", "Return it to service");
  }
  if (status === "maintenance") {
    return fail(
      "serviceable",
      "aircraft",
      `${droneId} is in maintenance.`,
      "901.29",
      "Complete the service",
    );
  }
  if (overdueCriticalInspections.length > 0) {
    return fail(
      "serviceable",
      "aircraft",
      `${droneId} has an overdue critical inspection: ${overdueCriticalInspections.join(", ")}.`,
      "901.29",
      "Complete the inspection",
    );
  }
  if (hoursUntilService !== null && hoursUntilService <= 0) {
    return fail(
      "serviceable",
      "aircraft",
      `${droneId} has passed its hours-based service interval.`,
      "901.29",
      "Complete the service",
    );
  }
  return pass("serviceable", "aircraft");
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

export type Readiness = {
  ready: boolean;
  verdicts: Verdict[];
  /** What stops the flight. */
  blocking: Verdict[];
  /** What qualifies it — supervision, an unverified certificate. */
  advisories: Verdict[];
  /** Which gates failed, for the three-dot indicator on the roster. */
  gates: Record<Gate, boolean>;
};

/**
 * The whole rule, in the order the plan states it.
 *
 * Every predicate runs — none short-circuits — because someone who is blocked
 * on four things needs to see four things, not to fix one and be told about
 * the next.
 */
export function evaluateReadiness(input: ReadinessInput): Readiness {
  const verdicts = [
    certificateOk(input),
    recencyOk(input),
    ageOk(input),
    workAuthorizationOk(input),
    trainingOk(input),
    authorizationOk(input),
    documentsOk(input),
    competencyOk(input),
    registrationOk(input),
    declarationOk(input),
    serviceableOk(input),
  ];

  const blocking = verdicts.filter((v) => !v.pass && v.severity === "blocking");
  const advisories = verdicts.filter((v) => !v.pass && v.severity === "advisory");

  const gates: Record<Gate, boolean> = { A: true, B: true, C: true, aircraft: true };
  for (const verdict of blocking) gates[verdict.gate] = false;

  return { ready: blocking.length === 0, verdicts, blocking, advisories, gates };
}

/**
 * One line saying why a flight cannot go, for a form that has to refuse it.
 *
 * The first blocking reason, plus a count — a refusal that lists eleven things
 * is one nobody reads to the end of.
 */
export function refusalMessage(readiness: Readiness): string | null {
  if (readiness.ready) return null;
  const [first, ...rest] = readiness.blocking;
  const more = rest.length > 0 ? ` (and ${rest.length} other ${rest.length === 1 ? "problem" : "problems"})` : "";
  return `${first.reason}${more}`;
}
