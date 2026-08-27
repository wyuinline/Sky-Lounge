/**
 * Option lists for the fixed-choice selects.
 *
 * Gathered here because the same four severities appear on an incident, an
 * audit finding and a flight request, and three copies of a list drift: one
 * gets "Critical", another "critical", and a filter silently stops matching.
 *
 * These describe *choices offered in the interface*. The stored values are the
 * database's enums, so a value added to an enum without being added here is
 * simply not offered — which is the safe direction.
 */

import type { SelectOption } from "@/components/portal/option-select";
import { certificateTypeLabel } from "@/lib/compliance";
import { documentCategories } from "@/lib/document-categories";

/** Used for incidents, audit findings and flight-request risk alike. */
export const severityOptions: SelectOption<"low" | "medium" | "high" | "critical">[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const incidentTypeOptions: SelectOption[] = [
  { value: "near_miss", label: "Near miss" },
  { value: "crash", label: "Crash" },
  { value: "equipment_failure", label: "Equipment failure" },
  { value: "safety_hazard", label: "Safety hazard" },
  { value: "regulatory_breach", label: "Regulatory breach" },
];

export const uavStatusOptions: SelectOption[] = [
  { value: "airworthy", label: "Airworthy" },
  { value: "maintenance", label: "In maintenance" },
  { value: "grounded", label: "Grounded" },
  { value: "retired", label: "Retired" },
];

export const maintenanceTypeOptions: SelectOption[] = [
  { value: "preventive", label: "Preventive" },
  { value: "repair", label: "Repair" },
  { value: "calibration", label: "Calibration" },
  { value: "battery", label: "Battery" },
  { value: "firmware", label: "Firmware" },
];

export const auditTypeOptions: SelectOption[] = [
  { value: "internal", label: "Internal" },
  { value: "regulatory", label: "Regulatory" },
];

export const competencyOptions: SelectOption[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "qualified", label: "Qualified" },
];

/** Transport Canada's three certificate levels, in order of privilege. */
export const certificateTypeOptions: SelectOption[] = [
  "basic_operations",
  "advanced_operations",
  "level_1_complex",
].map((value) => ({ value, label: certificateTypeLabel[value] }));

export const documentCategoryOptions: SelectOption[] = documentCategories.map((c) => ({
  value: c.value,
  label: c.label,
}));

/**
 * Prepends an "everything" choice to a filter's options.
 *
 * Filters need it and forms must not have it, so it is added at the point of
 * use rather than baked into the lists above.
 */
export function withAll<T extends string>(
  options: readonly SelectOption<T>[],
  label: string,
): SelectOption<T | "all">[] {
  return [{ value: "all" as T | "all", label }, ...options];
}
