import { describe, it, expect } from "vitest";
import {
  addMonths,
  daysUntil,
  documentReviewDue,
  deriveExpiryStatus,
  derivePilotCertificateStatus,
  derivePilotCurrency,
  recencyDue,
  isAuditOverdue,
  isFindingOverdue,
  isMaintenanceOverdue,
  isoDaysFromNow,
  todayIso,
} from "./compliance";

// Fixed reference date so tests never depend on the day they run.
const NOW = new Date(2026, 5, 15); // 15 June 2026, local time

describe("todayIso", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(todayIso(NOW)).toBe("2026-06-15");
  });

  it("zero-pads single-digit months and days", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("isoDaysFromNow", () => {
  it("moves forward and backward across month boundaries", () => {
    expect(isoDaysFromNow(30, NOW)).toBe("2026-07-15");
    expect(isoDaysFromNow(-30, NOW)).toBe("2026-05-16");
  });
});

describe("daysUntil", () => {
  it("returns null when there is no date", () => {
    expect(daysUntil(null, NOW)).toBeNull();
  });

  it("returns 0 for today", () => {
    expect(daysUntil("2026-06-15", NOW)).toBe(0);
  });

  it("returns negative for past dates", () => {
    expect(daysUntil("2026-06-14", NOW)).toBe(-1);
  });

  it("ignores a time component on a timestamp", () => {
    expect(daysUntil("2026-06-20T23:59:59Z", NOW)).toBe(5);
  });

  it("returns null for an unparseable date", () => {
    expect(daysUntil("not-a-date", NOW)).toBeNull();
  });
});

describe("deriveExpiryStatus", () => {
  it("treats a missing expiry as current — it does not expire", () => {
    expect(deriveExpiryStatus(null, NOW)).toBe("current");
  });

  it("reports expired the day after the expiry date", () => {
    expect(deriveExpiryStatus("2026-06-14", NOW)).toBe("expired");
  });

  it("is still current on the expiry date itself", () => {
    expect(deriveExpiryStatus("2026-06-15", NOW)).toBe("due_soon");
  });

  it("reports due_soon inside the window and current outside it", () => {
    expect(deriveExpiryStatus("2026-08-01", NOW)).toBe("due_soon"); // 47 days
    expect(deriveExpiryStatus("2026-09-01", NOW)).toBe("current"); // 78 days
  });

  it("treats the last day of the window as due_soon, not current", () => {
    expect(deriveExpiryStatus(isoDaysFromNow(60, NOW), NOW)).toBe("due_soon");
    expect(deriveExpiryStatus(isoDaysFromNow(61, NOW), NOW)).toBe("current");
  });

  it("honours a custom window", () => {
    expect(deriveExpiryStatus("2026-07-01", NOW, 30)).toBe("due_soon");
    expect(deriveExpiryStatus("2026-07-01", NOW, 5)).toBe("current");
  });
});

describe("isMaintenanceOverdue", () => {
  it("is overdue when outstanding past the service date", () => {
    expect(
      isMaintenanceOverdue({ status: "scheduled", next_service_date: "2026-06-01" }, NOW),
    ).toBe(true);
  });

  it("is never overdue once completed, however late", () => {
    expect(
      isMaintenanceOverdue({ status: "completed", next_service_date: "2020-01-01" }, NOW),
    ).toBe(false);
  });

  it("is not overdue on the service date itself", () => {
    expect(
      isMaintenanceOverdue({ status: "scheduled", next_service_date: "2026-06-15" }, NOW),
    ).toBe(false);
  });

  it("is not overdue without a service date", () => {
    expect(isMaintenanceOverdue({ status: "scheduled", next_service_date: null }, NOW)).toBe(
      false,
    );
  });
});

describe("isFindingOverdue", () => {
  it("is overdue when open past its due date", () => {
    expect(isFindingOverdue({ status: "open", due_date: "2026-06-01" }, NOW)).toBe(true);
  });

  it("is not overdue once closed", () => {
    expect(isFindingOverdue({ status: "closed", due_date: "2026-06-01" }, NOW)).toBe(false);
  });

  it("counts in_progress findings as overdue — work started is not work finished", () => {
    expect(isFindingOverdue({ status: "in_progress", due_date: "2026-06-01" }, NOW)).toBe(true);
  });
});

describe("isAuditOverdue", () => {
  it("is overdue when a planned audit's date has passed", () => {
    expect(isAuditOverdue({ status: "planned", audit_date: "2026-06-01" }, NOW)).toBe(true);
  });

  it("is not overdue once completed", () => {
    expect(isAuditOverdue({ status: "completed", audit_date: "2026-06-01" }, NOW)).toBe(false);
  });
});

describe("recencyDue", () => {
  it("returns null when no activity has been recorded", () => {
    expect(recencyDue(null)).toBeNull();
  });

  it("adds 24 months, matching the operational sheet", () => {
    // The sheet shows 2026-08-11 -> 2028-08-11.
    expect(recencyDue("2026-08-11")).toBe("2028-08-11");
  });

  it("clamps month overflow toward the earlier date", () => {
    // 31 Aug + 24 months is still 31 Aug; check a genuine overflow case.
    expect(recencyDue("2026-08-31", 6)).toBe("2027-02-28");
  });

  it("returns null for an unparseable date", () => {
    expect(recencyDue("nonsense")).toBeNull();
  });
});

describe("derivePilotCertificateStatus", () => {
  it("returns null when nothing is on file, rather than implying compliance", () => {
    expect(derivePilotCertificateStatus(null, null, NOW)).toBeNull();
  });

  it("is current when both the certificate and recency are comfortably valid", () => {
    expect(derivePilotCertificateStatus("2028-08-11", "2026-06-01", NOW)).toBe("current");
  });

  it("is expired when the certificate has lapsed", () => {
    expect(derivePilotCertificateStatus("2026-01-01", "2026-06-01", NOW)).toBe("expired");
  });

  it("is expired when recency has lapsed even though the certificate is valid", () => {
    // Last activity in 2023 means recency fell due in 2025.
    expect(derivePilotCertificateStatus("2030-01-01", "2023-01-01", NOW)).toBe("expired");
  });

  it("reports the worst of the two", () => {
    expect(derivePilotCertificateStatus("2026-07-01", "2023-01-01", NOW)).toBe("expired");
  });

  it("works from recency alone when no certificate expiry is recorded", () => {
    expect(derivePilotCertificateStatus(null, "2023-01-01", NOW)).toBe("expired");
  });
});

describe("derivePilotCurrency", () => {
  it("is current when the medical is valid and there are no certifications", () => {
    expect(derivePilotCurrency("2027-01-01", [], NOW)).toBe("current");
  });

  it("is expired when the medical has lapsed, regardless of certifications", () => {
    expect(derivePilotCurrency("2026-01-01", ["2027-01-01"], NOW)).toBe("expired");
  });

  it("is expired when any single certification has lapsed", () => {
    expect(derivePilotCurrency("2027-01-01", ["2027-01-01", "2026-01-01"], NOW)).toBe("expired");
  });

  it("reports the worst state, so expired beats due_soon", () => {
    expect(derivePilotCurrency("2026-07-01", ["2026-01-01"], NOW)).toBe("expired");
  });

  it("is due_soon when the nearest credential is inside the window", () => {
    expect(derivePilotCurrency("2027-01-01", ["2026-07-01"], NOW)).toBe("due_soon");
  });

  it("treats a pilot with no recorded medical as current, not expired", () => {
    expect(derivePilotCurrency(null, [], NOW)).toBe("current");
  });
});

describe("documentReviewDue", () => {
  const base = {
    last_reviewed_at: null,
    effective_date: "2025-01-15",
    created_at: "2025-03-01T10:00:00Z",
    review_interval_months: 12,
  };

  it("runs the clock from the effective date when never reviewed", () => {
    expect(documentReviewDue(base)).toBe("2026-01-15");
  });

  it("runs the clock from the last review once there is one", () => {
    expect(documentReviewDue({ ...base, last_reviewed_at: "2025-06-30" })).toBe("2026-06-30");
  });

  it("falls back to the created date when no effective date is set", () => {
    expect(documentReviewDue({ ...base, effective_date: null })).toBe("2026-03-01");
  });

  it("returns null when the document never needs reviewing", () => {
    // A ROC-A radio certificate, or a report of something that already
    // happened — no date should be produced for these at all.
    expect(documentReviewDue({ ...base, review_interval_months: null })).toBeNull();
  });

  it("returns null when there is no date to count from", () => {
    expect(
      documentReviewDue({
        last_reviewed_at: null,
        effective_date: null,
        created_at: null,
        review_interval_months: 12,
      }),
    ).toBeNull();
  });

  it("handles the two-year cycle", () => {
    expect(documentReviewDue({ ...base, review_interval_months: 24 })).toBe("2027-01-15");
  });

  it("clamps rather than overflowing into the next month", () => {
    // 31 Aug + 6 months is "Feb 31", which Date rolls into March and which
    // would push a compliance deadline later than it should be.
    expect(
      documentReviewDue({
        ...base,
        effective_date: "2025-08-31",
        review_interval_months: 6,
      }),
    ).toBe("2026-02-28");
  });
});

describe("addMonths", () => {
  it("clamps to the last day of a shorter target month", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28");
  });

  it("returns null for a missing or unparseable date", () => {
    expect(addMonths(null, 12)).toBeNull();
    expect(addMonths("not-a-date", 12)).toBeNull();
  });
});
