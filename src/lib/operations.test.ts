import { describe, it, expect } from "vitest";
import {
  requiredOperations,
  checkAuthorisations,
  refusalMessage,
  operationOrder,
  type OperationType,
} from "@/lib/operations";

const held = (ops: OperationType[], valid = true) =>
  ops.map((operation) => ({ operation, currently_valid: valid }));

describe("requiredOperations", () => {
  it("requires VLOS even for the plainest flight", () => {
    // The baseline, not a special case: a pilot with nothing on file should be
    // refused rather than silently permitted.
    expect(requiredOperations({})).toEqual(["vlos"]);
  });

  it("requires EVLOS instead of VLOS when an observer is used", () => {
    expect(requiredOperations({ has_observer: true })).toEqual(["evlos"]);
  });

  it("requires BVLOS alone, not BVLOS plus VLOS", () => {
    // The aircraft is out of sight; demanding an unaided-sight authorisation
    // as well would be nonsense.
    expect(requiredOperations({ is_bvlos: true })).toEqual(["bvlos"]);
  });

  it("lets BVLOS supersede an observer too", () => {
    expect(requiredOperations({ is_bvlos: true, has_observer: true })).toEqual(["bvlos"]);
  });

  it("adds each special condition on top of the sight category", () => {
    expect(
      requiredOperations({
        is_night: true,
        is_over_people: true,
        is_sheltered: true,
        controlled_airspace: true,
        medium_rpas: true,
      }),
    ).toEqual([
      "vlos",
      "night",
      "over_people",
      "sheltered",
      "controlled_airspace",
      "medium_rpas",
    ]);
  });

  it("treats null and undefined as not applying", () => {
    expect(requiredOperations({ is_night: null, is_bvlos: undefined })).toEqual(["vlos"]);
  });
});

describe("checkAuthorisations", () => {
  it("clears a pilot who holds everything required", () => {
    const verdict = checkAuthorisations(["vlos", "night"], held(["vlos", "night", "bvlos"]));
    expect(verdict.cleared).toBe(true);
    expect(verdict.missing).toEqual([]);
    expect(verdict.lapsed).toEqual([]);
  });

  it("refuses a pilot missing an authorisation", () => {
    const verdict = checkAuthorisations(["vlos", "night"], held(["vlos"]));
    expect(verdict.cleared).toBe(false);
    expect(verdict.missing).toEqual(["night"]);
    expect(verdict.lapsed).toEqual([]);
  });

  it("separates a lapsed authorisation from a missing one", () => {
    // Different problems: one needs a check ride, the other needs a signature.
    const verdict = checkAuthorisations(
      ["vlos", "bvlos"],
      [
        { operation: "vlos", currently_valid: true },
        { operation: "bvlos", currently_valid: false },
      ],
    );
    expect(verdict.cleared).toBe(false);
    expect(verdict.missing).toEqual([]);
    expect(verdict.lapsed).toEqual(["bvlos"]);
  });

  it("reports both kinds at once", () => {
    const verdict = checkAuthorisations(
      ["vlos", "bvlos", "night"],
      [
        { operation: "vlos", currently_valid: true },
        { operation: "bvlos", currently_valid: false },
      ],
    );
    expect(verdict.missing).toEqual(["night"]);
    expect(verdict.lapsed).toEqual(["bvlos"]);
  });

  it("refuses a pilot with no authorisations at all", () => {
    expect(checkAuthorisations(["vlos"], []).cleared).toBe(false);
  });

  it("ignores authorisations the flight does not need", () => {
    const verdict = checkAuthorisations(["vlos"], held(operationOrder));
    expect(verdict.cleared).toBe(true);
  });
});

describe("refusalMessage", () => {
  it("says nothing when the pilot is cleared", () => {
    expect(refusalMessage("Jordan Reyes", { cleared: true, missing: [], lapsed: [] })).toBeNull();
  });

  it("names what is missing and what to do", () => {
    const message = refusalMessage("Jordan Reyes", {
      cleared: false,
      missing: ["night"],
      lapsed: [],
    });
    expect(message).toContain("Jordan Reyes");
    expect(message).toContain("Night");
    expect(message).toContain("Record the authorisation");
  });

  it("distinguishes lapsed from missing in the wording", () => {
    const message = refusalMessage("Sam Okafor", {
      cleared: false,
      missing: [],
      lapsed: ["bvlos"],
    })!;
    expect(message).toContain("lapsed");
    expect(message).not.toContain("not authorised for");
  });

  it("reads as one sentence when both apply", () => {
    const message = refusalMessage("Sam Okafor", {
      cleared: false,
      missing: ["night"],
      lapsed: ["bvlos"],
    })!;
    expect(message).toContain("not authorised for");
    expect(message).toContain("and has a lapsed authorisation");
  });
});
