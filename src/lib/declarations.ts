/**
 * Which manufacturer declarations a flight needs.
 *
 * CAR 901.69 is a matrix over three things: how big the aircraft is, how close
 * it goes to people, and whether it is in controlled airspace. The portal
 * already records all three, but had no way to say what they add up to.
 *
 * Kept separate from the pilot's authorisation, which is a different axis
 * entirely. A pilot is authorised for BVLOS; an *aircraft* holds a declaration
 * for flying over people. Conflating them is how an operator ends up believing
 * a qualified pilot makes an undeclared aircraft legal.
 */

import type { Database } from "@/lib/database.types";

export type RpasOperation = Database["public"]["Enums"]["rpas_operation"];
export type RpasCategory = Database["public"]["Enums"]["rpas_category"];
export type PeopleProximity = Database["public"]["Enums"]["people_proximity"];

export type FlightCharacteristics = {
  /** Null when the aircraft's category has not been recorded. */
  category: RpasCategory | null;
  proximity: PeopleProximity;
  /** Controlled airspace, whatever the reason. */
  controlledAirspace: boolean;
  sheltered: boolean;
};

/** The regulatory matrix, as the database holds it. */
export type DeclarationRequirement = {
  operation: RpasOperation;
  label: string;
  rpasStandard: string;
  declarationType: "declaration" | "pre_validated_declaration";
  carReference: string;
};

/**
 * The declarations this flight requires.
 *
 * More than one is normal and correct: a small aircraft flying over people in
 * controlled airspace needs both 922.06 and 922.04. Returning a single "worst"
 * operation would let the other requirement pass unnoticed.
 *
 * An aircraft with no category recorded returns nothing, and the caller treats
 * that as "cannot tell" rather than "nothing required" — see
 * declarationVerdict below.
 */
export function requiredDeclarations(flight: FlightCharacteristics): RpasOperation[] {
  if (flight.category === null) return [];

  const required: RpasOperation[] = [];

  if (flight.category === "small") {
    if (flight.proximity === "over") required.push("small_over_people");
    else if (flight.proximity === "near") required.push("small_near_people");

    if (flight.controlledAirspace) {
      // A sheltered operation in controlled airspace is its own row in the
      // matrix, not the ordinary controlled-airspace one.
      required.push(
        flight.sheltered ? "small_sheltered_controlled" : "small_vlos_controlled",
      );
    }
  } else {
    // Medium: over 25 kg to 150 kg. Proximity always matters, because even
    // away from people a medium aircraft needs 922.08.
    if (flight.proximity === "over") required.push("medium_over_people");
    else if (flight.proximity === "near") required.push("medium_near_people");
    else required.push("medium_vlos_away");

    if (flight.controlledAirspace) required.push("medium_vlos_controlled");
  }

  return required;
}

/**
 * Whether an aircraft may fly this, given what it holds.
 *
 * "Cannot tell" is reported separately from "not allowed". An aircraft whose
 * category was never recorded is a gap in the record, and telling someone it
 * is unairworthy would send them looking for a fault that is not there.
 */
export type DeclarationVerdict =
  | { status: "ok"; required: RpasOperation[] }
  | { status: "unknown_category"; required: [] }
  | { status: "missing"; required: RpasOperation[]; missing: RpasOperation[] };

export function declarationVerdict(
  flight: FlightCharacteristics,
  held: RpasOperation[],
): DeclarationVerdict {
  if (flight.category === null) return { status: "unknown_category", required: [] };

  const required = requiredDeclarations(flight);
  const heldSet = new Set(held);
  const missing = required.filter((operation) => !heldSet.has(operation));

  return missing.length === 0
    ? { status: "ok", required }
    : { status: "missing", required, missing };
}

/** How the flight's characteristics read in a sentence. */
export function describeFlight(
  flight: FlightCharacteristics,
  labels: Record<string, string> = {},
): string {
  const parts: string[] = [];
  parts.push(flight.category === "medium" ? "Medium aircraft" : "Small aircraft");
  if (flight.proximity === "over") parts.push("over people");
  else if (flight.proximity === "near") parts.push("near people");
  if (flight.sheltered) parts.push("sheltered");
  if (flight.controlledAirspace) parts.push("in controlled airspace");
  const described = parts.join(", ");
  return labels[described] ?? described;
}
