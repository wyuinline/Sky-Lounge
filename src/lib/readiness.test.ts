import { describe, it, expect } from "vitest";
import {
  evaluateReadiness,
  refusalMessage,
  ageOn,
  levelSatisfies,
  MINIMUM_AGE,
  type ReadinessInput,
} from "@/lib/readiness";

const FLIGHT_DATE = "2026-09-03";

/** A pilot and aircraft with every gate satisfied, to vary one thing at a time. */
function ready(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    flightDate: FLIGHT_DATE,
    requiredLevel: "advanced",
    certificates: [{ level: "advanced", issuedOn: "2024-01-15", verifiedOn: "2024-01-20" }],
    recencyExpiries: ["2027-06-01"],
    dateOfBirth: "1990-05-12",
    workAuthorizationExpiresOn: null,
    training: [
      { code: "OPS-MANUAL", name: "Operations Manual orientation", expiresOn: "2027-01-01" },
      { code: "EMERGENCY", name: "Emergency procedures", expiresOn: "2027-01-01" },
    ],
    authorization: {
      coversOperation: true,
      coversAircraft: true,
      supervisionRequired: false,
      supervisorName: null,
      reviewDueOn: "2027-01-01",
    },
    unacknowledgedDocuments: [],
    competencies: [
      { type: "airframe", expiresOn: "2027-01-01", subject: "Matrice 350 RTK" },
      { type: "payload", expiresOn: null, subject: "L2 LiDAR" },
    ],
    requiredCompetencies: ["airframe", "payload"],
    aircraft: {
      droneId: "UAV-001",
      status: "airworthy",
      registrationNumber: "C-1234567",
      markingVerifiedOn: "2025-03-01",
      hasDeclarationForOperation: true,
      operationLabel: "Small, near people (under 30 m, over 5 m)",
      declarationCarReference: "901.69(b)",
      hoursUntilService: 40,
      overdueCriticalInspections: [],
    },
    ...over,
  };
}

describe("a fully compliant assignment", () => {
  it("is ready, with nothing flagged", () => {
    const result = evaluateReadiness(ready());
    expect(result.ready).toBe(true);
    expect(result.blocking).toHaveLength(0);
    expect(result.advisories).toHaveLength(0);
    expect(result.gates).toEqual({ A: true, B: true, C: true, aircraft: true });
    expect(refusalMessage(result)).toBeNull();
  });
});

describe("Gate A — Transport Canada credential", () => {
  it("refuses a pilot with no certificate at the required level", () => {
    const result = evaluateReadiness(
      ready({
        requiredLevel: "level_1_complex",
        certificates: [{ level: "advanced", issuedOn: "2024-01-15", verifiedOn: "2024-01-20" }],
      }),
    );
    expect(result.ready).toBe(false);
    expect(result.gates.A).toBe(false);
    expect(result.blocking[0].reason).toContain("Level 1 Complex");
    expect(result.blocking[0].carReference).toContain("901");
  });

  it("accepts a higher certificate for a lower requirement", () => {
    // Level 1 Complex covers an Advanced operation.
    const result = evaluateReadiness(
      ready({
        requiredLevel: "advanced",
        certificates: [
          { level: "level_1_complex", issuedOn: "2024-01-15", verifiedOn: "2024-01-20" },
        ],
      }),
    );
    expect(result.ready).toBe(true);
  });

  it("flags an unverified certificate without refusing the flight", () => {
    // The certificate may well be genuine; never having checked one is a gap
    // an inspector finds, not a reason to ground somebody today.
    const result = evaluateReadiness(
      ready({ certificates: [{ level: "advanced", issuedOn: "2024-01-15", verifiedOn: null }] }),
    );
    expect(result.ready).toBe(true);
    expect(result.advisories[0].reason).toContain("not been verified");
  });

  it("refuses lapsed recency and says when it lapsed", () => {
    const result = evaluateReadiness(ready({ recencyExpiries: ["2026-06-01"] }));
    expect(result.ready).toBe(false);
    expect(result.blocking[0].reason).toContain("2026-06-01");
    expect(result.blocking[0].remediation).toContain("self-paced study");
  });

  it("takes the latest recency record, not the first", () => {
    // Earlier records are history. One current activity is what the CAR asks.
    const result = evaluateReadiness(
      ready({ recencyExpiries: ["2025-01-01", "2027-06-01", "2024-01-01"] }),
    );
    expect(result.ready).toBe(true);
  });

  it("refuses a pilot with no recency record at all", () => {
    const result = evaluateReadiness(ready({ recencyExpiries: [] }));
    expect(result.blocking[0].reason).toContain("No recency activity");
  });

  it("treats recency expiring on the flight date as lapsed", () => {
    // Expiry is the day it stops counting, not the last day it counts.
    const result = evaluateReadiness(ready({ recencyExpiries: [FLIGHT_DATE] }));
    expect(result.ready).toBe(false);
  });

  it("refuses someone under age for the level", () => {
    const result = evaluateReadiness(
      ready({
        requiredLevel: "level_1_complex",
        certificates: [
          { level: "level_1_complex", issuedOn: "2026-01-15", verifiedOn: "2026-01-20" },
        ],
        dateOfBirth: "2010-05-12",
      }),
    );
    expect(result.ready).toBe(false);
    expect(result.blocking.some((v) => v.reason?.includes("minimum age of 18"))).toBe(true);
  });

  it("does not fail the age gate when no date of birth is held", () => {
    // An operator may deliberately hold no birth dates and check the gate by
    // hand at application. That is a choice, not a failure.
    const result = evaluateReadiness(ready({ requiredLevel: "level_1_complex", dateOfBirth: null,
      certificates: [{ level: "level_1_complex", issuedOn: "2024-01-15", verifiedOn: "2024-01-20" }] }));
    expect(result.ready).toBe(true);
  });

  it("refuses an expired work authorization without calling it a CAR matter", () => {
    const result = evaluateReadiness(ready({ workAuthorizationExpiresOn: "2026-08-01" }));
    expect(result.ready).toBe(false);
    const verdict = result.blocking.find((v) => v.predicate === "work_authorization");
    expect(verdict?.reason).toContain("2026-08-01");
    // Immigration is IRCC's, not Transport Canada's, and mislabelling it in a
    // document an inspector reads would be wrong.
    expect(verdict?.carReference).toBeNull();
  });
});

describe("Gate B — company authorization", () => {
  it("refuses training that was never delivered", () => {
    const result = evaluateReadiness(
      ready({
        training: [
          { code: "OPS-MANUAL", name: "Operations Manual orientation", expiresOn: null },
        ],
      }),
    );
    expect(result.gates.B).toBe(false);
    expect(result.blocking[0].reason).toContain("Operations Manual orientation");
    expect(result.blocking[0].carReference).toBe("901.219");
  });

  it("refuses lapsed training and names what lapsed and when", () => {
    const result = evaluateReadiness(
      ready({
        training: [
          { code: "EMERGENCY", name: "Emergency procedures", expiresOn: "2026-01-01" },
          { code: "SMS", name: "Safety management processes", expiresOn: "2027-01-01" },
        ],
      }),
    );
    expect(result.blocking[0].reason).toContain("Emergency procedures (2026-01-01)");
    expect(result.blocking[0].reason).not.toContain("Safety management");
  });

  it("refuses when there is no authorization at all", () => {
    const result = evaluateReadiness(ready({ authorization: null }));
    expect(result.blocking.some((v) => v.reason?.includes("No company authorization"))).toBe(true);
  });

  it("refuses an authorization that does not cover this operation", () => {
    const result = evaluateReadiness(
      ready({ authorization: { ...ready().authorization!, coversOperation: false } }),
    );
    expect(result.blocking[0].reason).toContain("does not cover this kind of operation");
  });

  it("refuses an authorization that does not cover this aircraft", () => {
    const result = evaluateReadiness(
      ready({ authorization: { ...ready().authorization!, coversAircraft: false } }),
    );
    expect(result.blocking[0].reason).toContain("UAV-001");
  });

  it("names the supervisor rather than blocking a supervised pilot", () => {
    // The plan is explicit: supervision surfaces as a warning with a named
    // supervisor, not a hard block.
    const result = evaluateReadiness(
      ready({
        authorization: {
          ...ready().authorization!,
          supervisionRequired: true,
          supervisorName: "Dana Okonkwo",
        },
      }),
    );
    expect(result.ready).toBe(true);
    expect(result.advisories[0].reason).toContain("Dana Okonkwo");
  });

  it("flags unacknowledged documents without grounding the flight", () => {
    const result = evaluateReadiness(
      ready({ unacknowledgedDocuments: ["Operations Manual rev 4"] }),
    );
    expect(result.ready).toBe(true);
    expect(result.advisories[0].reason).toContain("Operations Manual rev 4");
  });
});

describe("Gate C — type competency", () => {
  it("refuses a pilot never assessed on the airframe", () => {
    const result = evaluateReadiness(
      ready({ competencies: [{ type: "payload", expiresOn: null, subject: "L2" }] }),
    );
    expect(result.gates.C).toBe(false);
    expect(result.blocking[0].reason).toContain("airframe");
  });

  it("refuses a lapsed assessment", () => {
    const result = evaluateReadiness(
      ready({
        competencies: [
          { type: "airframe", expiresOn: "2026-01-01", subject: "M350" },
          { type: "payload", expiresOn: null, subject: "L2" },
        ],
      }),
    );
    expect(result.blocking[0].reason).toContain("lapsed");
  });

  it("accepts an assessment with no expiry as permanent", () => {
    const result = evaluateReadiness(
      ready({
        competencies: [
          { type: "airframe", expiresOn: null, subject: "M350" },
          { type: "payload", expiresOn: null, subject: "L2" },
        ],
      }),
    );
    expect(result.ready).toBe(true);
  });

  it("accepts any current assessment of the required type", () => {
    // Two airframe sign-offs, one lapsed: the current one is enough.
    const result = evaluateReadiness(
      ready({
        competencies: [
          { type: "airframe", expiresOn: "2025-01-01", subject: "M300" },
          { type: "airframe", expiresOn: "2027-01-01", subject: "M350" },
          { type: "payload", expiresOn: null, subject: "L2" },
        ],
      }),
    );
    expect(result.ready).toBe(true);
  });

  it("requires nothing when the assignment requires nothing", () => {
    const result = evaluateReadiness(ready({ requiredCompetencies: [], competencies: [] }));
    expect(result.ready).toBe(true);
  });
});

describe("the aircraft", () => {
  it("refuses an operation the aircraft has no declaration for", () => {
    // The gap most operators miss, and the one with a $5,000 corporate fine.
    const result = evaluateReadiness(
      ready({ aircraft: { ...ready().aircraft, hasDeclarationForOperation: false } }),
    );
    expect(result.ready).toBe(false);
    const verdict = result.blocking.find((v) => v.predicate === "declaration");
    expect(verdict?.reason).toContain("Small, near people");
    expect(verdict?.carReference).toBe("901.69(b)");
  });

  it("refuses an unregistered aircraft", () => {
    const result = evaluateReadiness(
      ready({ aircraft: { ...ready().aircraft, registrationNumber: null } }),
    );
    expect(result.blocking.some((v) => v.carReference === "901.02")).toBe(true);
  });

  it("flags an unverified marking without grounding the aircraft", () => {
    // It is registered; someone has to go and look at the airframe.
    const result = evaluateReadiness(
      ready({ aircraft: { ...ready().aircraft, markingVerifiedOn: null } }),
    );
    expect(result.ready).toBe(true);
    expect(result.advisories[0].reason).toContain("marking");
  });

  it("refuses a grounded, retired or in-maintenance aircraft", () => {
    for (const status of ["grounded", "retired", "maintenance"]) {
      const result = evaluateReadiness(ready({ aircraft: { ...ready().aircraft, status } }));
      expect(result.ready, status).toBe(false);
    }
  });

  it("refuses an overdue critical inspection by name", () => {
    const result = evaluateReadiness(
      ready({
        aircraft: { ...ready().aircraft, overdueCriticalInspections: ["Annual airframe inspection"] },
      }),
    );
    expect(result.blocking[0].reason).toContain("Annual airframe inspection");
  });

  it("refuses an aircraft past its hours interval", () => {
    const result = evaluateReadiness(
      ready({ aircraft: { ...ready().aircraft, hoursUntilService: 0 } }),
    );
    expect(result.blocking[0].reason).toContain("service interval");
  });
});

describe("reporting the verdict", () => {
  it("runs every predicate rather than stopping at the first failure", () => {
    // Someone blocked on four things needs to see four things, not to fix one
    // and be told about the next.
    const result = evaluateReadiness(
      ready({
        recencyExpiries: [],
        authorization: null,
        competencies: [],
        aircraft: { ...ready().aircraft, hasDeclarationForOperation: false },
      }),
    );
    expect(result.blocking.length).toBeGreaterThanOrEqual(4);
    expect(new Set(result.blocking.map((v) => v.gate))).toEqual(
      new Set(["A", "B", "C", "aircraft"]),
    );
  });

  it("gives every failure a remediation, so nobody has to go hunting", () => {
    const result = evaluateReadiness(
      ready({ recencyExpiries: [], authorization: null, competencies: [] }),
    );
    for (const verdict of result.blocking) {
      expect(verdict.remediation, verdict.predicate).toBeTruthy();
    }
  });

  it("summarises a refusal in one line with a count of the rest", () => {
    const result = evaluateReadiness(ready({ recencyExpiries: [], authorization: null }));
    const message = refusalMessage(result);
    expect(message).toContain("No recency activity");
    expect(message).toContain("1 other problem");
  });

  it("says nothing when the flight may go", () => {
    expect(refusalMessage(evaluateReadiness(ready()))).toBeNull();
  });

  it("marks only the gates that actually blocked", () => {
    const result = evaluateReadiness(ready({ recencyExpiries: [] }));
    expect(result.gates).toEqual({ A: false, B: true, C: true, aircraft: true });
  });

  it("does not let an advisory close a gate", () => {
    const result = evaluateReadiness(
      ready({ unacknowledgedDocuments: ["Ops Manual rev 4"] }),
    );
    expect(result.gates.B).toBe(true);
    expect(result.ready).toBe(true);
  });
});

describe("ageOn", () => {
  it("counts whole years", () => {
    expect(ageOn("2000-09-03", "2026-09-03")).toBe(26);
    // The day before the birthday is still the previous age.
    expect(ageOn("2000-09-04", "2026-09-03")).toBe(25);
  });

  it("handles a leap-day birth without going wrong", () => {
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });
});

describe("levelSatisfies", () => {
  it("orders the certificate levels by privilege", () => {
    expect(levelSatisfies("level_1_complex", "basic")).toBe(true);
    expect(levelSatisfies("advanced", "advanced")).toBe(true);
    expect(levelSatisfies("basic", "advanced")).toBe(false);
  });

  it("uses the ages Transport Canada sets", () => {
    expect(MINIMUM_AGE.advanced).toBe(16);
    expect(MINIMUM_AGE.level_1_complex).toBe(18);
  });
});
