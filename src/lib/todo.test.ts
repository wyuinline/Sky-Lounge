import { describe, it, expect } from "vitest";
import { buildTodoList, countBySeverity, sortTodos, type TodoItem } from "@/lib/todo";

const now = new Date("2026-11-06T12:00:00");

describe("buildTodoList", () => {
  it("is empty when nothing needs attention", () => {
    expect(
      buildTodoList(
        {
          pilots: [
            {
              id: "p1",
              full_name: "All Current",
              certificate_expires: "2030-01-01",
              last_recency_activity: "2026-06-01",
              has_roc_a: true,
              certificate_type: "advanced_operations",
            },
          ],
        },
        now,
      ),
    ).toEqual([]);
  });

  it("makes one item per reason, not per row", () => {
    // A pilot whose certificate has expired *and* whose recency lapsed has two
    // separate jobs to do, and a single line would hide one of them.
    const items = buildTodoList(
      {
        pilots: [
          {
            id: "p1",
            full_name: "Jordan Reyes",
            certificate_expires: "2026-10-01",
            last_recency_activity: "2024-01-01",
            has_roc_a: false,
            certificate_type: "advanced_operations",
          },
        ],
      },
      now,
    );
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.subject === "Jordan Reyes")).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it("points each item at the page where it gets fixed", () => {
    const items = buildTodoList(
      {
        uavs: [
          {
            id: "u1",
            drone_id: "UAV-001",
            status: "airworthy",
            next_inspection_date: "2026-11-10",
            hours_until_service: null,
          },
        ],
      },
      now,
    );
    expect(items[0].href).toBe("/fleet");
    expect(items[0].area).toBe("UAV Fleet");
  });

  it("gathers every source into one list", () => {
    const items = buildTodoList(
      {
        pilots: [
          {
            id: "p1",
            full_name: "P",
            certificate_expires: "2026-11-10",
            last_recency_activity: "2026-06-01",
            has_roc_a: true,
            certificate_type: "advanced_operations",
          },
        ],
        uavs: [
          { id: "u1", drone_id: "U", status: "grounded", next_inspection_date: null, hours_until_service: null },
        ],
        maintenance: [{ id: "m1", drone_id: "U", status: "scheduled", next_service_date: "2026-11-10" }],
        requests: [{ id: "r1", pilot_name: "P", approval_status: "pending", requested_date: "2026-12-01" }],
        logs: [{ id: "l1", pilot_name: "P", flight_date: "2026-11-01", acknowledged_at: null }],
        incidents: [{ id: "i1", incident_date: "2026-11-01", incident_type: "near_miss", status: "open", severity: "low" }],
        documents: [
          {
            id: "d1",
            title: "SOP",
            last_reviewed_at: null,
            effective_date: "2025-11-10",
            created_at: null,
            review_interval_months: 12,
            expires_at: null,
          },
        ],
      },
      now,
    );
    expect(new Set(items.map((i) => i.area))).toEqual(
      new Set([
        "Pilots & Crew",
        "UAV Fleet",
        "Maintenance",
        "Flight Operations",
        "Incidents & Safety",
        "Documents",
      ]),
    );
  });

  it("drops an item as soon as the underlying work is done", () => {
    const source = {
      maintenance: [{ id: "m1", drone_id: "U", status: "scheduled", next_service_date: "2026-11-10" }],
    };
    expect(buildTodoList(source, now)).toHaveLength(1);

    const completed = {
      maintenance: [{ id: "m1", drone_id: "U", status: "completed", next_service_date: "2026-11-10" }],
    };
    expect(buildTodoList(completed, now)).toEqual([]);
  });

  it("clears a missing-document item once the file is filed", () => {
    const missing = {
      pilots: [
        {
          id: "p1",
          full_name: "P",
          certificate_expires: "2030-01-01",
          last_recency_activity: "2026-06-01",
          has_roc_a: false,
          certificate_type: "advanced_operations",
        },
      ],
    };
    expect(buildTodoList(missing, now)).toHaveLength(1);

    const filed = {
      pilots: [{ ...missing.pilots[0], has_roc_a: true }],
    };
    expect(buildTodoList(filed, now)).toEqual([]);
  });
});

describe("sortTodos", () => {
  function item(over: Partial<TodoItem>): TodoItem {
    return {
      id: "x",
      severity: "attention",
      subject: "S",
      reason: "R",
      href: "/",
      area: "A",
      dueDate: null,
      ...over,
    };
  }

  it("puts overdue before upcoming", () => {
    const sorted = sortTodos(
      [
        item({ id: "a", severity: "attention", dueDate: "2026-11-07" }),
        item({ id: "b", severity: "overdue", dueDate: "2026-11-05" }),
      ],
      now,
    );
    expect(sorted.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("puts the longest overdue first", () => {
    const sorted = sortTodos(
      [
        item({ id: "recent", severity: "overdue", dueDate: "2026-11-05" }),
        item({ id: "ancient", severity: "overdue", dueDate: "2026-01-01" }),
      ],
      now,
    );
    expect(sorted.map((i) => i.id)).toEqual(["ancient", "recent"]);
  });

  it("sorts undated items last within their group", () => {
    const sorted = sortTodos(
      [
        item({ id: "undated", severity: "overdue", dueDate: null }),
        item({ id: "dated", severity: "overdue", dueDate: "2026-11-05" }),
      ],
      now,
    );
    expect(sorted.map((i) => i.id)).toEqual(["dated", "undated"]);
  });

  it("breaks ties by subject so the order is stable between renders", () => {
    const sorted = sortTodos(
      [
        item({ id: "z", subject: "Zulu", dueDate: "2026-11-10" }),
        item({ id: "a", subject: "Alpha", dueDate: "2026-11-10" }),
      ],
      now,
    );
    expect(sorted.map((i) => i.subject)).toEqual(["Alpha", "Zulu"]);
  });
});

describe("countBySeverity", () => {
  it("counts each severity", () => {
    const counts = countBySeverity([
      { id: "1", severity: "overdue", subject: "", reason: "", href: "/", area: "", dueDate: null },
      { id: "2", severity: "attention", subject: "", reason: "", href: "/", area: "", dueDate: null },
      { id: "3", severity: "attention", subject: "", reason: "", href: "/", area: "", dueDate: null },
    ]);
    expect(counts).toEqual({ overdue: 1, attention: 2 });
  });
});
