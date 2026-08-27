import { describe, it, expect } from "vitest";
import {
  nearestClock,
  dueVerdict,
  intervalSummary,
  sortPlanStatus,
  groundingItems,
  summariseForAircraft,
  WARN_DAYS,
  WARN_HOURS,
  type PlanItemStatus,
} from "@/lib/inspection-plans";

function status(over: Partial<PlanItemStatus> = {}): PlanItemStatus {
  return {
    uav_id: "u1",
    drone_id: "UAV-001",
    plan_name: "Matrice 350 schedule",
    item_id: "i1",
    item_name: "Propeller inspection",
    is_critical: false,
    sort_order: 0,
    interval_hours: 50,
    interval_cycles: null,
    interval_months: null,
    hours_remaining: 20,
    cycles_remaining: null,
    days_remaining: null,
    due_date: null,
    last_completed_on: "2026-06-01",
    current_hours: 130,
    current_cycles: 88,
    is_due: false,
    ...over,
  };
}

describe("nearestClock", () => {
  it("uses the only clock an item has", () => {
    expect(nearestClock(status())).toBe("hours");
  });

  it("compares clocks as a fraction of their own interval", () => {
    // 10 hours of a 50-hour interval is 20% left; 100 days of a 12-month
    // interval is 27% left. Comparing the raw numbers would pick the wrong one.
    const row = status({
      interval_hours: 50,
      hours_remaining: 10,
      interval_months: 12,
      days_remaining: 100,
    });
    expect(nearestClock(row)).toBe("hours");
  });

  it("picks the calendar clock when it really is nearer", () => {
    const row = status({
      interval_hours: 50,
      hours_remaining: 40,
      interval_months: 12,
      days_remaining: 5,
    });
    expect(nearestClock(row)).toBe("calendar");
  });

  it("picks the cycles clock when it is nearest", () => {
    const row = status({
      interval_hours: 200,
      hours_remaining: 180,
      interval_cycles: 100,
      cycles_remaining: 2,
    });
    expect(nearestClock(row)).toBe("cycles");
  });

  it("returns nothing for an item with no clock", () => {
    expect(
      nearestClock(
        status({ interval_hours: null, hours_remaining: null, interval_months: null }),
      ),
    ).toBeNull();
  });
});

describe("dueVerdict", () => {
  it("says how far off a comfortable item is, in its own units", () => {
    const verdict = dueVerdict(status({ hours_remaining: 20 }));
    expect(verdict.summary).toBe("Due in 20 flight hours");
    expect(verdict.severity).toBe("good");
    expect(verdict.overdue).toBe(false);
  });

  it("warns inside the threshold", () => {
    const verdict = dueVerdict(status({ hours_remaining: WARN_HOURS }));
    expect(verdict.severity).toBe("warning");
    expect(verdict.overdue).toBe(false);
  });

  it("treats zero remaining as due, not as nearly due", () => {
    const verdict = dueVerdict(status({ hours_remaining: 0 }));
    expect(verdict.overdue).toBe(true);
    expect(verdict.summary).toBe("Overdue by 0 flight hours");
  });

  it("reports an overdue amount as a positive number", () => {
    // "Overdue by -6 hours" is how a reader stops trusting the column.
    expect(dueVerdict(status({ hours_remaining: -6 })).summary).toBe(
      "Overdue by 6 flight hours",
    );
  });

  it("escalates an overdue critical item and not an ordinary one", () => {
    expect(dueVerdict(status({ hours_remaining: -1, is_critical: true })).severity).toBe(
      "critical",
    );
    // Grounding an aircraft over a late cosmetic check is how people learn to
    // ignore every flag.
    expect(dueVerdict(status({ hours_remaining: -1, is_critical: false })).severity).toBe(
      "warning",
    );
  });

  it("uses days for a calendar item", () => {
    const row = status({
      interval_hours: null,
      hours_remaining: null,
      interval_months: 12,
      days_remaining: WARN_DAYS - 1,
    });
    const verdict = dueVerdict(row);
    expect(verdict.clock).toBe("calendar");
    expect(verdict.summary).toBe(`Due in ${WARN_DAYS - 1} days`);
    expect(verdict.severity).toBe("warning");
  });

  it("says so plainly when an item has no interval at all", () => {
    const verdict = dueVerdict(
      status({ interval_hours: null, hours_remaining: null, interval_months: null }),
    );
    expect(verdict.summary).toBe("No interval set");
    expect(verdict.severity).toBe("good");
  });

  it("singularises one", () => {
    expect(dueVerdict(status({ hours_remaining: 1 })).summary).toBe("Due in 1 flight hour");
    expect(
      dueVerdict(
        status({
          interval_hours: null,
          hours_remaining: null,
          interval_cycles: 100,
          cycles_remaining: 1,
        }),
      ).summary,
    ).toBe("Due in 1 flight");
  });
});

describe("intervalSummary", () => {
  it("joins clocks with 'or', because whichever falls first wins", () => {
    expect(
      intervalSummary({ interval_hours: 50, interval_cycles: null, interval_months: 6 }),
    ).toBe("Every 50 h or 6 months");
  });

  it("says a year rather than twelve months", () => {
    expect(
      intervalSummary({ interval_hours: null, interval_cycles: null, interval_months: 12 }),
    ).toBe("Every 1 year");
  });

  it("names all three when all three are set", () => {
    expect(
      intervalSummary({ interval_hours: 200, interval_cycles: 500, interval_months: 24 }),
    ).toBe("Every 200 h or 500 flights or 24 months");
  });

  it("says when there is nothing", () => {
    expect(
      intervalSummary({ interval_hours: null, interval_cycles: null, interval_months: null }),
    ).toBe("No interval");
  });
});

describe("sortPlanStatus", () => {
  it("puts what needs doing at the top", () => {
    const rows = [
      status({ item_id: "fine", hours_remaining: 40 }),
      status({ item_id: "overdue-critical", hours_remaining: -2, is_critical: true }),
      status({ item_id: "soon", hours_remaining: 2 }),
    ];
    expect(sortPlanStatus(rows).map((r) => r.item_id)).toEqual([
      "overdue-critical",
      "soon",
      "fine",
    ]);
  });

  it("groups by aircraft, then by the plan's own order", () => {
    const rows = [
      status({ item_id: "b", drone_id: "UAV-002", sort_order: 1, hours_remaining: 40 }),
      status({ item_id: "a2", drone_id: "UAV-001", sort_order: 2, hours_remaining: 40 }),
      status({ item_id: "a1", drone_id: "UAV-001", sort_order: 1, hours_remaining: 40 }),
    ];
    expect(sortPlanStatus(rows).map((r) => r.item_id)).toEqual(["a1", "a2", "b"]);
  });

  it("leaves the caller's array alone", () => {
    const rows = [status({ item_id: "a" }), status({ item_id: "b", hours_remaining: -1 })];
    sortPlanStatus(rows);
    expect(rows.map((r) => r.item_id)).toEqual(["a", "b"]);
  });
});

describe("groundingItems", () => {
  it("holds an aircraft only for an overdue critical item", () => {
    const rows = [
      status({ item_id: "critical-overdue", is_critical: true, hours_remaining: -1 }),
      status({ item_id: "critical-due-soon", is_critical: true, hours_remaining: 1 }),
      status({ item_id: "ordinary-overdue", is_critical: false, hours_remaining: -50 }),
    ];
    expect(groundingItems(rows).map((r) => r.item_id)).toEqual(["critical-overdue"]);
  });
});

describe("summariseForAircraft", () => {
  it("counts overdue and due-soon separately", () => {
    const summary = summariseForAircraft([
      status({ hours_remaining: -3, is_critical: true }),
      status({ hours_remaining: -1 }),
      status({ hours_remaining: 2 }),
      status({ hours_remaining: 40 }),
    ]);
    expect(summary).toEqual({ overdue: 2, dueSoon: 1, grounding: 1 });
  });

  it("reports zeroes for an aircraft with nothing due", () => {
    expect(summariseForAircraft([status({ hours_remaining: 40 })])).toEqual({
      overdue: 0,
      dueSoon: 0,
      grounding: 0,
    });
  });
});
