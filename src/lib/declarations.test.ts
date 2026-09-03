import { describe, it, expect } from "vitest";
import {
  requiredDeclarations,
  declarationVerdict,
  describeFlight,
  type FlightCharacteristics,
} from "@/lib/declarations";

function flight(over: Partial<FlightCharacteristics> = {}): FlightCharacteristics {
  return {
    category: "small",
    proximity: "away",
    controlledAirspace: false,
    sheltered: false,
    ...over,
  };
}

describe("requiredDeclarations — small aircraft", () => {
  it("needs nothing for a plain flight away from people in uncontrolled airspace", () => {
    expect(requiredDeclarations(flight())).toEqual([]);
  });

  it("needs 922.05 near people", () => {
    expect(requiredDeclarations(flight({ proximity: "near" }))).toEqual(["small_near_people"]);
  });

  it("needs 922.06 over people", () => {
    expect(requiredDeclarations(flight({ proximity: "over" }))).toEqual(["small_over_people"]);
  });

  it("needs 922.04 in controlled airspace", () => {
    expect(requiredDeclarations(flight({ controlledAirspace: true }))).toEqual([
      "small_vlos_controlled",
    ]);
  });

  it("uses the sheltered row when sheltered in controlled airspace", () => {
    // A sheltered operation in controlled airspace is its own row in the
    // matrix, not the ordinary controlled-airspace one.
    expect(
      requiredDeclarations(flight({ controlledAirspace: true, sheltered: true })),
    ).toEqual(["small_sheltered_controlled"]);
  });

  it("stacks proximity and airspace, because both are required", () => {
    // Returning only the "worst" one would let the other pass unnoticed.
    expect(
      requiredDeclarations(flight({ proximity: "over", controlledAirspace: true })),
    ).toEqual(["small_over_people", "small_vlos_controlled"]);
  });

  it("does not need an airspace declaration when sheltered outside controlled airspace", () => {
    expect(requiredDeclarations(flight({ sheltered: true }))).toEqual([]);
  });
});

describe("requiredDeclarations — medium aircraft", () => {
  it("needs 922.08 even away from people", () => {
    // Unlike a small aircraft, a medium one always needs a declaration.
    expect(requiredDeclarations(flight({ category: "medium" }))).toEqual([
      "medium_vlos_away",
    ]);
  });

  it("needs the pre-validated declarations near and over people", () => {
    expect(requiredDeclarations(flight({ category: "medium", proximity: "near" }))).toEqual([
      "medium_near_people",
    ]);
    expect(requiredDeclarations(flight({ category: "medium", proximity: "over" }))).toEqual([
      "medium_over_people",
    ]);
  });

  it("adds the controlled-airspace row on top", () => {
    expect(
      requiredDeclarations(flight({ category: "medium", proximity: "over", controlledAirspace: true })),
    ).toEqual(["medium_over_people", "medium_vlos_controlled"]);
  });
});

describe("declarationVerdict", () => {
  it("passes an aircraft holding everything the flight needs", () => {
    const verdict = declarationVerdict(flight({ proximity: "over" }), [
      "small_over_people",
      "small_vlos_controlled",
    ]);
    expect(verdict.status).toBe("ok");
  });

  it("names exactly what is missing, not everything required", () => {
    const verdict = declarationVerdict(
      flight({ proximity: "over", controlledAirspace: true }),
      ["small_over_people"],
    );
    expect(verdict.status).toBe("missing");
    expect(verdict.status === "missing" && verdict.missing).toEqual(["small_vlos_controlled"]);
    expect(verdict.status === "missing" && verdict.required).toHaveLength(2);
  });

  it("passes a flight that requires nothing", () => {
    expect(declarationVerdict(flight(), []).status).toBe("ok");
  });

  it("says it cannot tell when the category was never recorded", () => {
    // A gap in the record is not the same as an unairworthy aircraft, and
    // telling someone it is would send them hunting for a fault that is not
    // there.
    const verdict = declarationVerdict(flight({ category: null, proximity: "over" }), []);
    expect(verdict.status).toBe("unknown_category");
  });

  it("ignores declarations the flight does not need", () => {
    const verdict = declarationVerdict(flight(), ["small_over_people", "medium_vlos_away"]);
    expect(verdict.status).toBe("ok");
  });
});

describe("describeFlight", () => {
  it("says what the flight is, in the words the matrix uses", () => {
    expect(describeFlight(flight({ proximity: "over", controlledAirspace: true }))).toBe(
      "Small aircraft, over people, in controlled airspace",
    );
    expect(describeFlight(flight({ category: "medium" }))).toBe("Medium aircraft");
  });

  it("mentions sheltered before the airspace", () => {
    expect(describeFlight(flight({ sheltered: true, controlledAirspace: true }))).toBe(
      "Small aircraft, sheltered, in controlled airspace",
    );
  });
});
