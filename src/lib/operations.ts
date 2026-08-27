/**
 * Operation types a pilot is separately authorised for.
 *
 * These are the distinctions Canadian rules draw, so they are the ones the
 * portal draws. A current certificate says a pilot may fly; an authorisation
 * says what they may fly, and the two are not the same question.
 */

export type OperationType =
  | "vlos"
  | "evlos"
  | "bvlos"
  | "sheltered"
  | "controlled_airspace"
  | "over_people"
  | "night"
  | "medium_rpas";

export const operationOrder: OperationType[] = [
  "vlos",
  "evlos",
  "bvlos",
  "sheltered",
  "controlled_airspace",
  "over_people",
  "night",
  "medium_rpas",
];

export const operationLabel: Record<OperationType, string> = {
  vlos: "Visual line of sight",
  evlos: "Extended VLOS",
  bvlos: "Beyond visual line of sight",
  sheltered: "Sheltered operation",
  controlled_airspace: "Controlled airspace",
  over_people: "Over people",
  night: "Night",
  medium_rpas: "Medium RPAS (25–150 kg)",
};

/** Short form, for chips in a dense table. */
export const operationShort: Record<OperationType, string> = {
  vlos: "VLOS",
  evlos: "EVLOS",
  bvlos: "BVLOS",
  sheltered: "SHELT",
  controlled_airspace: "CTRL",
  over_people: "OVER PPL",
  night: "NIGHT",
  medium_rpas: "MEDIUM",
};

export const operationDescription: Record<OperationType, string> = {
  vlos: "The pilot keeps the aircraft in sight unaided throughout.",
  evlos: "Sight is maintained through a trained visual observer.",
  bvlos: "The aircraft goes beyond anyone's sight. Needs Level 1 Complex or an SFOC.",
  sheltered: "Within 100 m of a structure and below its highest point.",
  controlled_airspace: "Requires a NAV Drone authorisation for the flight.",
  over_people: "Flight over people who are not part of the crew.",
  night: "Between the end and beginning of civil twilight.",
  medium_rpas: "Aircraft between 25 and 150 kg.",
};

/**
 * Which authorisations a flight needs, given what it is doing.
 *
 * Every flight is at least VLOS: it is the baseline authorisation rather than
 * a special case, and requiring it means a pilot with nothing on file is
 * refused rather than silently permitted.
 */
export function requiredOperations(flight: {
  is_bvlos?: boolean | null;
  is_night?: boolean | null;
  is_over_people?: boolean | null;
  is_sheltered?: boolean | null;
  controlled_airspace?: boolean | null;
  has_observer?: boolean | null;
  medium_rpas?: boolean | null;
}): OperationType[] {
  const required: OperationType[] = [];

  // BVLOS supersedes both VLOS and EVLOS — the aircraft is out of sight, so
  // demanding an unaided-sight authorisation as well would be nonsense.
  if (flight.is_bvlos) {
    required.push("bvlos");
  } else if (flight.has_observer) {
    required.push("evlos");
  } else {
    required.push("vlos");
  }

  if (flight.is_night) required.push("night");
  if (flight.is_over_people) required.push("over_people");
  if (flight.is_sheltered) required.push("sheltered");
  if (flight.controlled_airspace) required.push("controlled_airspace");
  if (flight.medium_rpas) required.push("medium_rpas");

  return required;
}

export type HeldAuthorisation = {
  operation: OperationType;
  currently_valid: boolean;
};

export type AuthorisationVerdict = {
  cleared: boolean;
  /** Needed and not held at all. */
  missing: OperationType[];
  /** Held, but the authorisation has lapsed. */
  lapsed: OperationType[];
};

/**
 * Whether a pilot is cleared for everything a flight requires.
 *
 * Missing and lapsed are reported separately because they are different
 * problems: one needs training or a check ride, the other needs a signature.
 */
export function checkAuthorisations(
  required: OperationType[],
  held: HeldAuthorisation[],
): AuthorisationVerdict {
  const byOperation = new Map(held.map((h) => [h.operation, h]));
  const missing: OperationType[] = [];
  const lapsed: OperationType[] = [];

  for (const operation of required) {
    const authorisation = byOperation.get(operation);
    if (!authorisation) missing.push(operation);
    else if (!authorisation.currently_valid) lapsed.push(operation);
  }

  return { cleared: missing.length === 0 && lapsed.length === 0, missing, lapsed };
}

/** The refusal, in words the requester can act on. */
export function refusalMessage(pilotName: string, verdict: AuthorisationVerdict): string | null {
  if (verdict.cleared) return null;

  const parts: string[] = [];
  if (verdict.missing.length > 0) {
    parts.push(
      `not authorised for ${verdict.missing.map((o) => operationLabel[o]).join(", ")}`,
    );
  }
  if (verdict.lapsed.length > 0) {
    parts.push(
      `has a lapsed authorisation for ${verdict.lapsed.map((o) => operationLabel[o]).join(", ")}`,
    );
  }

  return `${pilotName} is ${parts.join(", and ")}. Record the authorisation on their crew record, or assign a pilot who holds it.`;
}
