import { describe, it, expect } from "vitest";
import {
  deadlineFlag,
  documentFlags,
  flightLogFlags,
  flightRequestFlags,
  incidentFlags,
  maintenanceFlags,
  pilotFlags,
  uavFlags,
  worstSeverity,
  FLAG_LEAD_DAYS,
} from "@/lib/flags";

const now = new Date("2026-11-06T12:00:00");

describe("deadlineFlag", () => {
  it("raises a flag exactly two weeks before the date", () => {
    // The worked example: recency expiring 2026-11-20 should flag from
    // 2026-11-06, which is today in these tests.
    const flag = deadlineFlag("2026-11-20", "Recency", now);
    expect(flag).not.toBeNull();
    expect(flag?.severity).toBe("attention");
    expect(flag?.label).toContain("14 days");
  });

  it("stays quiet the day before the window opens", () => {
    expect(deadlineFlag("2026-11-21", "Recency", now)).toBeNull();
  });

  it("uses the agreed two-week lead", () => {
    expect(FLAG_LEAD_DAYS).toBe(14);
  });

  it("escalates once the date has passed", () => {
    const flag = deadlineFlag("2026-11-01", "Recency", now);
    expect(flag?.severity).toBe("overdue");
    expect(flag?.label).toContain("overdue by 5 days");
  });

  it("says 'today' rather than 'in 0 days'", () => {
    expect(deadlineFlag("2026-11-06", "Recency", now)?.label).toContain("due today");
  });

  it("returns nothing when there is no date to judge", () => {
    expect(deadlineFlag(null, "Recency", now)).toBeNull();
  });
});

describe("pilotFlags", () => {
  const base = {
    certificate_expires: "2030-01-01",
    last_recency_activity: "2029-01-01",
    has_roc_a: true,
    certificate_type: "advanced_operations",
  };

  it("is silent for a pilot who is fully current", () => {
    expect(pilotFlags(base, now)).toEqual([]);
  });

  it("flags recency two weeks before it lapses", () => {
    // Recency runs 24 months from the last activity: 2024-11-20 + 24 months
    // is 2026-11-20, so today (2026-11-06) is exactly the trigger.
    const flags = pilotFlags({ ...base, last_recency_activity: "2024-11-20" }, now);
    expect(flags).toHaveLength(1);
    expect(flags[0].label).toContain("Recency");
  });

  it("flags a missing ROC-A immediately, with no countdown", () => {
    const flags = pilotFlags({ ...base, has_roc_a: false }, now);
    expect(flags).toEqual([
      { severity: "overdue", label: "ROC-A certificate not on file" },
    ]);
  });

  it("clears the ROC-A flag once the file is on record", () => {
    expect(pilotFlags({ ...base, has_roc_a: true }, now)).toEqual([]);
  });

  it("does not demand a ROC-A from someone with no certificate at all", () => {
    expect(pilotFlags({ ...base, certificate_type: null, has_roc_a: false }, now)).toEqual([]);
  });

  it("reports certificate and recency separately", () => {
    const flags = pilotFlags(
      { ...base, certificate_expires: "2026-11-10", last_recency_activity: "2024-11-20" },
      now,
    );
    expect(flags).toHaveLength(2);
  });

  it("says nothing about someone who has left", () => {
    expect(pilotFlags({ ...base, has_roc_a: false, active: false }, now)).toEqual([]);
  });
});

describe("uavFlags", () => {
  const base = { status: "airworthy", next_inspection_date: null, hours_until_service: null };

  it("is silent for an airworthy airframe with nothing due", () => {
    expect(uavFlags(base, now)).toEqual([]);
  });

  it("flags a scheduled inspection two weeks out", () => {
    const flags = uavFlags({ ...base, next_inspection_date: "2026-11-20" }, now);
    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("attention");
  });

  it("flags a grounded airframe on its own", () => {
    expect(uavFlags({ ...base, status: "grounded" }, now)[0].label).toContain("Grounded");
  });

  it("never flags a retired airframe, whatever its dates say", () => {
    expect(
      uavFlags(
        { status: "retired", next_inspection_date: "2020-01-01", hours_until_service: -50 },
        now,
      ),
    ).toEqual([]);
  });

  it("flags the last stretch of an hours-based interval", () => {
    expect(uavFlags({ ...base, hours_until_service: 20 }, now)[0].severity).toBe("attention");
    expect(uavFlags({ ...base, hours_until_service: 30 }, now)).toEqual([]);
  });

  it("escalates once the hours are used up", () => {
    const flags = uavFlags({ ...base, hours_until_service: -3 }, now);
    expect(flags[0].severity).toBe("overdue");
    expect(flags[0].label).toContain("3 flight hours");
  });
});

describe("maintenanceFlags", () => {
  it("flags a service two weeks out", () => {
    expect(
      maintenanceFlags({ status: "scheduled", next_service_date: "2026-11-20" }, now),
    ).toHaveLength(1);
  });

  it("clears once the work is completed", () => {
    expect(
      maintenanceFlags({ status: "completed", next_service_date: "2020-01-01" }, now),
    ).toEqual([]);
  });

  it("escalates a service that is already late", () => {
    const flags = maintenanceFlags({ status: "scheduled", next_service_date: "2026-10-01" }, now);
    expect(flags[0].severity).toBe("overdue");
  });
});

describe("documentFlags", () => {
  const base = {
    last_reviewed_at: null,
    effective_date: "2025-11-20",
    created_at: null,
    review_interval_months: 12,
    expires_at: null,
  };

  it("flags an annual review two weeks before it falls due", () => {
    expect(documentFlags(base, now)).toHaveLength(1);
  });

  it("clears once the document is reviewed", () => {
    expect(documentFlags({ ...base, last_reviewed_at: "2026-11-01" }, now)).toEqual([]);
  });

  it("says nothing about a document that never needs reviewing", () => {
    expect(documentFlags({ ...base, review_interval_months: null }, now)).toEqual([]);
  });

  it("reports review and expiry independently", () => {
    const flags = documentFlags({ ...base, expires_at: "2026-11-10" }, now);
    expect(flags).toHaveLength(2);
  });
});

describe("flightRequestFlags", () => {
  it("flags a request waiting on an approver", () => {
    expect(
      flightRequestFlags({ approval_status: "pending", requested_date: "2026-12-01" }, now),
    ).toEqual([{ severity: "attention", label: "Waiting for approval" }]);
  });

  it("escalates when the flight date has already gone by", () => {
    expect(
      flightRequestFlags({ approval_status: "pending", requested_date: "2026-11-01" }, now)[0]
        .severity,
    ).toBe("overdue");
  });

  it("clears as soon as it is approved or rejected", () => {
    expect(
      flightRequestFlags({ approval_status: "approved", requested_date: "2026-11-01" }, now),
    ).toEqual([]);
    expect(
      flightRequestFlags({ approval_status: "rejected", requested_date: "2026-11-01" }, now),
    ).toEqual([]);
  });
});

describe("incidentFlags", () => {
  it("treats a high-severity open incident as overdue", () => {
    expect(incidentFlags({ status: "open", severity: "high" })[0].severity).toBe("overdue");
  });

  it("flags a low-severity open incident for attention", () => {
    expect(incidentFlags({ status: "open", severity: "low" })[0].severity).toBe("attention");
  });

  it("clears once closed", () => {
    expect(incidentFlags({ status: "closed", severity: "critical" })).toEqual([]);
  });
});

describe("flightLogFlags", () => {
  it("flags a newly filed log until someone confirms they have seen it", () => {
    expect(flightLogFlags({ acknowledged_at: null })).toHaveLength(1);
  });

  it("clears once acknowledged", () => {
    expect(flightLogFlags({ acknowledged_at: "2026-11-06T09:00:00Z" })).toEqual([]);
  });
});

describe("worstSeverity", () => {
  it("reports the worst of several flags", () => {
    expect(
      worstSeverity([
        { severity: "attention", label: "a" },
        { severity: "overdue", label: "b" },
      ]),
    ).toBe("overdue");
  });

  it("is null when there is nothing to report", () => {
    expect(worstSeverity([])).toBeNull();
  });
});
