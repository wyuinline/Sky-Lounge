import { describe, it, expect } from "vitest";
import {
  crossedHoursThreshold,
  crossedThreshold,
  scanAll,
  scanAudits,
  scanCertifications,
  scanDocuments,
  scanFindings,
  scanMaintenance,
  scanMaintenanceHours,
  scanPilotCredentials,
  type AirframeHoursRecord,
  type DocumentRecord,
  type PilotRecord,
} from "./reminders";
import { isoDaysFromNow } from "./compliance";

const NOW = new Date(2026, 5, 15); // 15 June 2026
const inDays = (n: number) => isoDaysFromNow(n, NOW);

const pilot = (over: Partial<PilotRecord> = {}): PilotRecord => ({
  id: "p1",
  full_name: "Jordan Reyes",
  certificate_expires: null,
  last_recency_activity: null,
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

describe("scanPilotCredentials — certificate", () => {
  it("ignores a pilot with nothing on file", () => {
    expect(scanPilotCredentials([pilot()], NOW)).toHaveLength(0);
  });

  it("ignores a certificate well beyond the warning window", () => {
    expect(scanPilotCredentials([pilot({ certificate_expires: inDays(200) })], NOW)).toHaveLength(0);
  });

  it("raises a critical reminder once expired", () => {
    const [r] = scanPilotCredentials([pilot({ certificate_expires: inDays(-3) })], NOW);
    expect(r.kind).toBe("pilot_certificate_expired");
    expect(r.severity).toBe("critical");
  });

  it("escalates severity as the date approaches", () => {
    const far = scanPilotCredentials([pilot({ certificate_expires: inDays(45) })], NOW)[0];
    const near = scanPilotCredentials([pilot({ certificate_expires: inDays(3) })], NOW)[0];
    expect(far.severity).toBe("low");
    expect(near.severity).toBe("high");
  });

  it("targets the affected pilot as well as the compliance roles", () => {
    const [r] = scanPilotCredentials([pilot({ certificate_expires: inDays(10) })], NOW);
    expect(r.target_profile_id).toBe("prof-1");
    expect(r.target_roles).toContain("uav_admin");
  });

  it("still reminds compliance when the pilot has no linked account", () => {
    const [r] = scanPilotCredentials([pilot({ certificate_expires: inDays(10), profile_id: null })], NOW);
    expect(r.target_profile_id).toBeNull();
    expect(r.target_roles.length).toBeGreaterThan(0);
  });

  it("produces a stable dedupe key so repeat runs do not duplicate", () => {
    const a = scanPilotCredentials([pilot({ certificate_expires: inDays(10) })], NOW)[0];
    const b = scanPilotCredentials([pilot({ certificate_expires: inDays(10) })], NOW)[0];
    expect(a.dedupe_key).toBe(b.dedupe_key);
  });

  it("produces a new key once a tighter threshold is crossed", () => {
    const at45 = scanPilotCredentials([pilot({ certificate_expires: inDays(45) })], NOW)[0];
    const at10 = scanPilotCredentials([pilot({ certificate_expires: inDays(10) })], NOW)[0];
    expect(at45.dedupe_key).not.toBe(at10.dedupe_key);
  });

  it("produces a new key after renewal, so the fresh expiry is tracked", () => {
    const before = scanPilotCredentials([pilot({ certificate_expires: inDays(5) })], NOW)[0];
    const renewed = scanPilotCredentials([pilot({ certificate_expires: inDays(400) })], NOW);
    expect(renewed).toHaveLength(0);
    expect(before.dedupe_key).toContain(inDays(5));
  });
});

describe("scanPilotCredentials — recency", () => {
  // Recency falls due 24 months after the activity.
  const recencyOn = (dueInDays: number) => isoDaysFromNow(dueInDays - 730, NOW);

  it("says nothing when no recency activity is recorded", () => {
    expect(scanPilotCredentials([pilot({ last_recency_activity: null })], NOW)).toHaveLength(0);
  });

  it("flags a pilot who is out of recency as critical", () => {
    const [r] = scanPilotCredentials(
      [pilot({ last_recency_activity: "2023-01-01" })],
      NOW,
    );
    expect(r.kind).toBe("recency_overdue");
    expect(r.severity).toBe("critical");
    expect(r.title).toContain("out of recency");
  });

  it("warns before recency falls due", () => {
    const [r] = scanPilotCredentials(
      [pilot({ last_recency_activity: recencyOn(20) })],
      NOW,
    );
    expect(r.kind).toBe("recency_due");
  });

  it("reports certificate and recency separately — one valid does not excuse the other", () => {
    const results = scanPilotCredentials(
      [
        pilot({
          certificate_expires: inDays(10), // expiring
          last_recency_activity: "2023-01-01", // already lapsed
        }),
      ],
      NOW,
    );
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.kind).sort()).toEqual([
      "pilot_certificate_expiring",
      "recency_overdue",
    ]);
  });

  it("keeps certificate and recency dedupe keys distinct", () => {
    const results = scanPilotCredentials(
      [pilot({ certificate_expires: inDays(-1), last_recency_activity: "2023-01-01" })],
      NOW,
    );
    expect(new Set(results.map((r) => r.dedupe_key)).size).toBe(results.length);
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
    expect(r.target_roles).toContain("uav_lead");
    expect(r.target_roles).not.toContain("pilot");
  });
});

describe("crossedHoursThreshold", () => {
  it("returns the tightest hours band crossed", () => {
    expect(crossedHoursThreshold(3)).toBe(5);
    expect(crossedHoursThreshold(8)).toBe(10);
    expect(crossedHoursThreshold(20)).toBe(25);
  });

  it("returns null when there is plenty of margin left", () => {
    expect(crossedHoursThreshold(80)).toBeNull();
  });

  it("includes the boundary itself", () => {
    expect(crossedHoursThreshold(25)).toBe(25);
  });
});

describe("scanMaintenanceHours", () => {
  const frame = (over: Partial<AirframeHoursRecord> = {}): AirframeHoursRecord => ({
    uav_id: "u1",
    drone_id: "ID-001",
    maintenance_interval_hours: 200,
    hours_since_service: 180,
    hours_until_service: 20,
    ...over,
  });

  it("skips airframes with no interval set — no schedule is not the same as up to date", () => {
    expect(
      scanMaintenanceHours([
        frame({ maintenance_interval_hours: null, hours_until_service: null }),
      ]),
    ).toHaveLength(0);
  });

  it("says nothing when there is plenty of margin", () => {
    expect(scanMaintenanceHours([frame({ hours_since_service: 20, hours_until_service: 180 })])).toHaveLength(0);
  });

  it("warns as the interval approaches", () => {
    const [r] = scanMaintenanceHours([frame()]);
    expect(r.kind).toBe("maintenance_hours_due");
    expect(r.title).toContain("ID-001");
    expect(r.title).toContain("200-hour service");
  });

  it("escalates severity as hours run down", () => {
    expect(scanMaintenanceHours([frame({ hours_until_service: 20 })])[0].severity).toBe("low");
    expect(scanMaintenanceHours([frame({ hours_until_service: 8 })])[0].severity).toBe("medium");
    expect(scanMaintenanceHours([frame({ hours_until_service: 3 })])[0].severity).toBe("high");
  });

  it("treats reaching the interval exactly as overdue, not merely due", () => {
    const [r] = scanMaintenanceHours([
      frame({ hours_since_service: 200, hours_until_service: 0 }),
    ]);
    expect(r.kind).toBe("maintenance_hours_overdue");
    expect(r.severity).toBe("critical");
  });

  it("flags an airframe flown past its interval", () => {
    const [r] = scanMaintenanceHours([
      frame({ hours_since_service: 214, hours_until_service: -14 }),
    ]);
    expect(r.kind).toBe("maintenance_hours_overdue");
    expect(r.body).toContain("214");
  });

  it("rounds fractional hours so the text stays readable", () => {
    const [r] = scanMaintenanceHours([
      frame({ hours_since_service: 187.66666, hours_until_service: 12.33333 }),
    ]);
    expect(r.title).toContain("12.3");
    expect(r.body).toContain("187.7");
  });

  it("keeps the dedupe key stable within a band as hours tick up", () => {
    const a = scanMaintenanceHours([frame({ hours_until_service: 9 })])[0];
    const b = scanMaintenanceHours([frame({ hours_until_service: 7 })])[0];
    expect(a.dedupe_key).toBe(b.dedupe_key);
  });

  it("issues a new key once a tighter band is crossed", () => {
    const at20 = scanMaintenanceHours([frame({ hours_until_service: 20 })])[0];
    const at4 = scanMaintenanceHours([frame({ hours_until_service: 4 })])[0];
    expect(at20.dedupe_key).not.toBe(at4.dedupe_key);
  });

  it("routes to the maintenance team", () => {
    const [r] = scanMaintenanceHours([frame()]);
    expect(r.target_roles).toContain("uav_lead");
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
          pilots: [pilot({ certificate_expires: inDays(300) })],
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
        pilots: [pilot({ certificate_expires: inDays(-1) })],
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

describe("scanDocuments", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  function doc(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
    return {
      id: "doc-1",
      title: "Flight Operations SOP",
      category: "sop",
      review_interval_months: 12,
      last_reviewed_at: null,
      effective_date: "2025-01-15",
      created_at: "2025-01-15T00:00:00Z",
      expires_at: null,
      pilot_name: null,
      pilot_profile_id: null,
      ...overrides,
    };
  }

  it("raises an overdue review once the annual clock has run out", () => {
    // Effective 2025-01-15, reviewed annually, so due 2026-01-15 — today.
    const results = scanDocuments([doc({ effective_date: "2024-11-01" })], now);
    const review = results.find((r) => r.kind === "document_review_overdue");
    expect(review).toBeDefined();
    expect(review?.due_date).toBe("2025-11-01");
    expect(review?.severity).toBe("high");
  });

  it("warns ahead of the review date", () => {
    const results = scanDocuments([doc({ effective_date: "2025-02-01" })], now);
    const review = results.find((r) => r.kind === "document_review_due");
    expect(review).toBeDefined();
    expect(review?.due_date).toBe("2026-02-01");
  });

  it("says nothing about a document that never needs reviewing", () => {
    // A ROC-A radio certificate does not expire and is never reviewed.
    const results = scanDocuments(
      [doc({ category: "roc_a", review_interval_months: null, effective_date: "2019-01-01" })],
      now,
    );
    expect(results).toEqual([]);
  });

  it("reaches the linked pilot as well as the responsible roles", () => {
    const results = scanDocuments(
      [
        doc({
          effective_date: "2024-11-01",
          pilot_name: "Jordan Reyes",
          pilot_profile_id: "profile-9",
        }),
      ],
      now,
    );
    expect(results[0].target_profile_id).toBe("profile-9");
    expect(results[0].target_roles).toContain("uav_admin");
  });

  it("treats a printed expiry as separate from the review clock", () => {
    // In date for review, but the document itself has expired: both facts
    // matter and collapsing them would hide one.
    const results = scanDocuments(
      [doc({ effective_date: "2025-12-01", expires_at: "2025-12-31" })],
      now,
    );
    expect(results.map((r) => r.kind)).toEqual(["document_expired"]);
  });

  it("can report a review and an expiry on the same document", () => {
    const results = scanDocuments(
      [doc({ effective_date: "2024-11-01", expires_at: "2026-01-20" })],
      now,
    );
    expect(results.map((r) => r.kind).sort()).toEqual([
      "document_expiring",
      "document_review_overdue",
    ]);
  });

  it("restarts the clock from the last review", () => {
    const results = scanDocuments(
      [doc({ effective_date: "2024-01-01", last_reviewed_at: "2025-12-01" })],
      now,
    );
    expect(results).toEqual([]);
  });

  it("gives every candidate a distinct dedupe key", () => {
    const results = scanDocuments(
      [
        doc({ id: "a", effective_date: "2024-11-01" }),
        doc({ id: "b", effective_date: "2024-11-01", expires_at: "2025-06-01" }),
      ],
      now,
    );
    expect(new Set(results.map((r) => r.dedupe_key)).size).toBe(results.length);
  });
});
