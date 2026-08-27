import { describe, it, expect } from "vitest";
import {
  severityOptions,
  incidentTypeOptions,
  uavStatusOptions,
  maintenanceTypeOptions,
  auditTypeOptions,
  competencyOptions,
  certificateTypeOptions,
  documentCategoryOptions,
  withAll,
} from "@/lib/select-options";
import { documentCategories } from "@/lib/document-categories";

const ALL_LISTS = {
  severityOptions,
  incidentTypeOptions,
  uavStatusOptions,
  maintenanceTypeOptions,
  auditTypeOptions,
  competencyOptions,
  certificateTypeOptions,
  documentCategoryOptions,
};

describe("option lists", () => {
  it("labels every option", () => {
    // A missing label leaves the trigger showing the stored value, which is
    // the whole reason these lists exist.
    for (const [name, options] of Object.entries(ALL_LISTS)) {
      for (const option of options) {
        expect(option.label, `${name}: ${option.value}`).toBeTruthy();
        expect(option.label, `${name}: ${option.value}`).not.toBe(option.value);
      }
    }
  });

  it("has no duplicate values in any list", () => {
    // A duplicate makes one of the two impossible to select, silently.
    for (const [name, options] of Object.entries(ALL_LISTS)) {
      const values = options.map((o) => o.value);
      expect(new Set(values).size, name).toBe(values.length);
    }
  });

  it("stores snake_case values, not display text", () => {
    // The value goes to Postgres. A label leaking into the value slot fails
    // the enum check at insert, on whichever record happens to use it first.
    for (const [name, options] of Object.entries(ALL_LISTS)) {
      for (const option of options) {
        expect(option.value, `${name}: ${option.value}`).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });

  it("offers every document category the portal accepts", () => {
    expect(documentCategoryOptions.map((o) => o.value)).toEqual(
      documentCategories.map((c) => c.value),
    );
  });

  it("orders the certificate types by privilege", () => {
    // Basic, then Advanced, then Level 1 Complex — the order Transport Canada
    // uses, and the order someone scanning the list expects.
    expect(certificateTypeOptions.map((o) => o.value)).toEqual([
      "basic_operations",
      "advanced_operations",
      "level_1_complex",
    ]);
  });
});

describe("withAll", () => {
  it("puts the everything option first", () => {
    const filtered = withAll(uavStatusOptions, "All statuses");
    expect(filtered[0]).toEqual({ value: "all", label: "All statuses" });
    expect(filtered).toHaveLength(uavStatusOptions.length + 1);
  });

  it("leaves the original list untouched", () => {
    // The same list backs a form, where "all" would be a storable value.
    const before = uavStatusOptions.length;
    withAll(uavStatusOptions, "All statuses");
    expect(uavStatusOptions).toHaveLength(before);
    expect(uavStatusOptions.some((o) => o.value === "all")).toBe(false);
  });
});
