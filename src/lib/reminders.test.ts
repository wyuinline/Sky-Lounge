import { describe, it, expect } from "vitest";
import {
  crossedThreshold,
  scanAll,
  scanAudits,
  scanCertifications,
  scanFindings,
  scanMaintenance,
  scanMedicals,
  type PilotRecord,
} from "./reminders";
import { isoDaysFromNow } from "./compliance";

const NOW = new Date(2026, 5, 15); // 15 June 2026
const inDays = (n: number) => isoDaysFromNow(n, NOW);

const pilot = (over: Partial<PilotRecord> = {}): PilotRecord => ({
  id: "p1",
  full_name: "Jordan Reyes",
  medical_expiry: null,
  profile_id: "prof-1",
  ...over,
});

describe("crossedThreshold", () => {
  it("returns the tightest threshold crossed", () => {
    expect(crossedThreshold(5)).toBe(7);
    expect(crossedThreshold(20)).toBe(30);
    expect(crossedThreshold(45)).toBe(60);
  });

  it("returns null when the date is beyond every threshold", () => {
    expect(crossedThreshold(90)).toBeNull();
  });

  it("includes the boundary day itself", () => {
    expect(crossedThreshold(7)).toBe(7);
    expect(crossedThreshold(30)).toBe(30);
    expect(crossedThreshold(60)).toBe(60);
  });
});

describe("scanMedicals", () => {
  it("ignores a pilot with no recorded medical", () => {
    expect(scanMedicals([pilot()], NOW)).toHaveLength(0);
  });

  it("ignores a medical well beyond the warning window", () => {
    expect(scanMedicals([pilot({ medical_expiry: inDays(200) })], NOW)).toHaveLength(0);
  });

  it("raises a critical reminder once expired", () => {
    const [r] = scanMedicals([pilot({ medical_expiry: inDays(-3) })], NOW);
    expect(r.kind).toBe("medical_expired");
    expect(r.severity).toBe("critical");
  });

  it("escalates severity as the date approaches", () => {
    const far = scanMedicals([pilot({ medical_expiry: inDays(45) })], NOW)[0];
    const near = scanMedicals([pilot({ medical_expiry: inDays(3) })], NOW)[0];
    expect(far.severity).toBe("low");
    expect(near.severity).toBe("high");
  });

  it("targets the affected pilot as well as the compliance roles", () => {
    const [r] = scanMedicals([pilot({ medical_expiry: inDays(10) })], NOW);
    expect(r.target_profile_id).toBe("prof-1");
    expect(r.target_roles).toContain("ops_manager");
  });

  it("still reminds compliance when the pilot has no linked account", () => {
    const [r] = scanMedicals([pilot({ medical_expiry: inDays(10), profile_id: null })], NOW);
    expect(r.target_profile_id).toBeNull();
    expect(r.target_roles.length).toBeGreaterThan(0);
  });

  it("produces a stable dedupe key so repeat runs do not duplicate", () => {
    const a = scanMedicals([pilot({ medical_expiry: inDays(10) })], NOW)[0];
    const b = scanMedicals([pilot({ medical_expiry: inDays(10) })], NOW)[0];
    expect(a.dedupe_key).toBe(b.dedupe_key);
  });

  it("produces a new key once a tighter threshold is crossed", () => {
    const at45 = scanMedicals([pilot({ medical_expiry: inDays(45) })], NOW)[0];
    const at10 = scanMedicals([pilot({ medical_expiry: inDays(10) })], NOW)[0];
    expect(at45.dedupe_key).not.toBe(at10.dedupe_key);
  });

  it("produces a new key after renewal, so the fresh expiry is tracked", () => {
    const before = scanMedicals([pilot({ medical_expiry: inDays(5) })], NOW)[0];
    const renewed = scanMedicals([pilot({ medical_expiry: inDays(400) })], NOW);
    expect(renewed).toHaveLength(0);
    expect(before.dedupe_key).toContain(inDays(5));
  });
});

describe("scanCertifications", () => {
  const cert = (expiry: string | null) => ({
    id: "c1",
    certification_name: "BVLOS Operations",
    expiry_date: expiry,
    pilot_id: "p1",
    pilot_name: "Jordan Reyes",
    pilot_profile_id: "prof-1",
  });

  it("flags an expired certification as critical", () => {
    const [r] = scanCertifications([cert(inDays(-1))], NOW);
    expect(r.kind).toBe("certification_expired");
    expect(r.severity).toBe("critical");
  });

  it("names the certification and pilot in the title", () => {
    const [r] = scanCertifications([cert(inDays(10))], NOW);
    expect(r.title).toContain("BVLOS Operations");
    expect(r.title).toContain("Jordan Reyes");
  });

  it("handles a certification with no pilot attached", () => {
    const orphan = { ...cert(inDays(10)), pilot_name: null, pilot_profile_id: null };
    const [r] = scanCertifications([orphan], NOW);
    expect(r.title).toContain("An unassigned pilot");
    expect(r.target_profile_id).toBeNull();
  });
});

describe("scanMaintenance", () => {
  const record = (over: Partial<Parameters<typeof scanMaintenance>[0][number]> = {}) => ({
    id: "m1",
    status: "scheduled",
    next_service_date: inDays(10),
    maintenance_type: "preventive",
    drone_id: "UAV-007",
    ...over,
  });

  it("never reminds about completed work, however late it ran", () => {
    expect(
      scanMaintenance([record({ status: "completed", next_service_date: inDays(-90) })], NOW),
    ).toHaveLength(0);
  });

  it("flags overdue work as critical", () => {
    const [r] = scanMaintenance([record({ next_service_date: inDays(-2) })], NOW);
    expect(r.kind).toBe("maintenance_overdue");
    expect(r.severity).toBe("critical");
  });

  it("warns ahead of the service date", () => {
    const [r] = scanMaintenance([record()], NOW);
    expect(r.kind).toBe("maintenance_due");
    expect(r.title).toContain("UAV-007");
  });

  it("routes to the maintenance team, not the pilots", () => {
    const [r] = scanMaintenance([record()], NOW);
    expect(r.target_roles).toContain("maintenance_team");
    expect(r.target_roles).not.toContain("pilot");
  });
});

describe("scanAudits", () => {
  it("flags a planned audit past its date as overdue", () => {
    const [r] = scanAudits(
      [{ id: "a1", status: "planned", audit_date: inDays(-5), audit_type: "regulatory" }],
      NOW,
    );
    expect(r.kind).toBe("audit_overdue");
    expect(r.title).toContain("Regulatory audit");
  });

  it("warns ahead of an upcoming audit", () => {
    const [r] = scanAudits(
      [{ id: "a1", status: "planned", audit_date: inDays(14), audit_type: "internal" }],
      NOW,
    );
    expect(r.kind).toBe("audit_upcoming");
  });

  it("says nothing about a completed audit", () => {
    expect(
      scanAudits(
        [{ id: "a1", status: "completed", audit_date: inDays(-5), audit_type: "internal" }],
        NOW,
      ),
    ).toHaveLength(0);
  });
});

describe("scanFindings", () => {
  it("flags an overdue finding and targets its owner", () => {
    const [r] = scanFindings(
      [
        {
          id: "f1",
          status: "open",
          due_date: inDays(-1),
          description: "Battery log incomplete",
          severity: "high",
          assigned_to: "prof-9",
        },
      ],
      NOW,
    );
    expect(r.kind).toBe("finding_overdue");
    expect(r.target_profile_id).toBe("prof-9");
    expect(r.body).toContain("Battery log incomplete");
  });

  it("says nothing about a closed finding", () => {
    expect(
      scanFindings(
        [
          {
            id: "f1",
            status: "closed",
            due_date: inDays(-30),
            description: "x",
            severity: "low",
            assigned_to: null,
          },
        ],
        NOW,
      ),
    ).toHaveLength(0);
  });
});

describe("scanAll", () => {
  it("returns nothing for a fully compliant operation", () => {
    expect(
      scanAll(
        {
          pilots: [pilot({ medical_expiry: inDays(300) })],
          certifications: [],
          maintenance: [],
          audits: [],
          findings: [],
        },
        NOW,
      ),
    ).toHaveLength(0);
  });

  it("emits unique dedupe keys across every category", () => {
    const results = scanAll(
      {
        pilots: [pilot({ medical_expiry: inDays(-1) })],
        certifications: [
          {
            id: "c1",
            certification_name: "Night Ops",
            expiry_date: inDays(5),
            pilot_id: "p1",
            pilot_name: "Jordan Reyes",
            pilot_profile_id: "prof-1",
          },
        ],
        maintenance: [
          {
            id: "m1",
            status: "scheduled",
            next_service_date: inDays(-3),
            maintenance_type: "battery",
            drone_id: "UAV-002",
          },
        ],
        audits: [{ id: "a1", status: "planned", audit_date: inDays(2), audit_type: "internal" }],
        findings: [
          {
            id: "f1",
            status: "open",
            due_date: inDays(-9),
            description: "Missing sign-off",
            severity: "medium",
            assigned_to: null,
          },
        ],
      },
      NOW,
    );

    expect(results).toHaveLength(5);
    expect(new Set(results.map((r) => r.dedupe_key)).size).toBe(5);
  });
});
