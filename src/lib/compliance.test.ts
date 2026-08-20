import { describe, it, expect } from "vitest";
import {
  daysUntil,
  deriveExpiryStatus,
  derivePilotCurrency,
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
