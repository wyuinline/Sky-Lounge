/**
 * What each import accepts.
 *
 * Data rather than code, so adding a column to an import is a line here and
 * nothing else — and so the whole surface of what can be brought in from a
 * spreadsheet can be read at a glance.
 *
 * Two rules run through all of them. Only the genuinely required columns are
 * marked required, because an operator's spreadsheet will not have every field
 * and refusing the import over a missing "location" would be absurd. And every
 * number has bounds, because the commonest spreadsheet error is a transposed
 * digit, and 5,000 flight hours on an airframe skews every derived figure the
 * portal computes from it.
 */

import type { ImportSchema } from "@/lib/csv-import";
import { uavStatusOptions, certificateTypeOptions } from "@/lib/select-options";
import type { SelectOption } from "@/components/portal/option-select";

/**
 * The labels the portal shows for a set of options, keyed by stored value.
 *
 * Drawn from the same lists the dropdowns are built from, so what a person
 * reads on screen is exactly what the importer will accept from a spreadsheet.
 * Two copies of these labels would eventually disagree, and the disagreement
 * would show up as an import mysteriously refusing a perfectly good file.
 */
function labelsOf(options: readonly SelectOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]));
}

/** Flight hours high enough to be wrong for any small UAV. */
const MAX_AIRFRAME_HOURS = 20000;

export const pilotImport: ImportSchema = {
  entity: "pilots",
  label: "pilots",
  table: "pilots",
  naturalKey: "full_name",
  fields: [
    {
      column: "full_name",
      label: "Full name",
      type: "text",
      required: true,
      aliases: ["name", "pilot", "pilot name", "crew", "crew member"],
    },
    {
      column: "certificate_number",
      label: "Certificate number",
      type: "text",
      aliases: ["certificate", "cert number", "rpas certificate", "licence", "license"],
    },
    {
      column: "certificate_type",
      label: "Certificate type",
      type: "enum",
      options: ["basic_operations", "advanced_operations", "level_1_complex"],
      optionLabels: labelsOf(certificateTypeOptions),
      aliases: ["cert type", "rating", "operations"],
    },
    {
      column: "certificate_issued",
      label: "Certificate issued",
      type: "date",
      aliases: ["issued", "issue date", "cert issued"],
    },
    {
      column: "certificate_expires",
      label: "Certificate expires",
      type: "date",
      aliases: ["expires", "expiry", "expiry date", "cert expires", "valid until"],
    },
    {
      column: "last_recency_activity",
      label: "Last recency activity",
      type: "date",
      aliases: ["recency", "last recency", "recency date", "last flight review"],
      hint: "Starts the 24-month recency clock",
    },
    {
      column: "flight_hours",
      label: "Flight hours",
      type: "number",
      min: 0,
      max: MAX_AIRFRAME_HOURS,
      aliases: ["hours", "total hours", "pilot hours"],
      hint: "Hours flown before the portal; logged flights add to this",
    },
    {
      column: "active",
      label: "Active",
      type: "boolean",
      aliases: ["status", "current", "employed"],
      hint: "yes / no — defaults to yes",
    },
    { column: "notes", label: "Notes", type: "text" },
  ],
};

export const uavImport: ImportSchema = {
  entity: "uavs",
  label: "aircraft",
  table: "uavs",
  naturalKey: "drone_id",
  fields: [
    {
      column: "drone_id",
      label: "Aircraft ID",
      type: "text",
      required: true,
      aliases: ["drone id", "uav", "uav id", "tail", "tail number", "asset id", "callsign"],
    },
    {
      column: "model",
      label: "Model",
      type: "text",
      required: true,
      aliases: ["aircraft model", "type"],
    },
    { column: "manufacturer", label: "Manufacturer", type: "text", aliases: ["make", "brand"] },
    {
      column: "serial_number",
      label: "Serial number",
      type: "text",
      aliases: ["serial", "sn", "msn"],
    },
    {
      column: "registration_number",
      label: "Registration number",
      type: "text",
      aliases: ["registration", "reg", "tc registration"],
    },
    {
      column: "status",
      label: "Status",
      type: "enum",
      options: ["airworthy", "maintenance", "grounded", "retired"],
      optionLabels: labelsOf(uavStatusOptions),
      aliases: ["condition", "serviceability"],
    },
    {
      column: "baseline_flight_hours",
      label: "Airframe hours",
      type: "number",
      min: 0,
      max: MAX_AIRFRAME_HOURS,
      aliases: ["hours", "total hours", "flight hours", "baseline hours", "tt", "total time"],
      // Without this every service interval counts from zero on the day the
      // portal is adopted, which is wrong for every airframe already in use.
      hint: "Hours flown before the portal — sets the service-interval clock",
    },
    {
      column: "maintenance_interval_hours",
      label: "Service interval (hours)",
      type: "integer",
      min: 1,
      max: 5000,
      aliases: ["service interval", "interval hours", "inspection interval"],
    },
    {
      column: "next_inspection_date",
      label: "Next inspection",
      type: "date",
      aliases: ["next inspection date", "next service", "inspection due"],
    },
    {
      column: "purchased_date",
      label: "Purchased",
      type: "date",
      aliases: ["purchase date", "acquired", "in service", "date acquired"],
    },
    {
      column: "weight_kg",
      label: "Weight (kg)",
      type: "number",
      min: 0,
      max: 500,
      aliases: ["weight", "mtow", "takeoff weight"],
    },
    {
      column: "firmware_version",
      label: "Firmware",
      type: "text",
      aliases: ["firmware version", "fw"],
    },
    {
      column: "location_site",
      label: "Location",
      type: "text",
      aliases: ["site", "base", "home base", "stored at"],
    },
    { column: "notes", label: "Notes", type: "text" },
  ],
};

export const batteryImport: ImportSchema = {
  entity: "batteries",
  label: "batteries",
  table: "batteries",
  naturalKey: "battery_id",
  fields: [
    {
      column: "battery_id",
      label: "Battery ID",
      type: "text",
      required: true,
      aliases: ["pack id", "pack", "battery", "asset id"],
    },
    { column: "model", label: "Model", type: "text", aliases: ["type"] },
    { column: "manufacturer", label: "Manufacturer", type: "text", aliases: ["make", "brand"] },
    {
      column: "serial_number",
      label: "Serial number",
      type: "text",
      aliases: ["serial", "sn"],
    },
    {
      column: "capacity_mah",
      label: "Capacity (mAh)",
      type: "integer",
      min: 1,
      max: 100000,
      aliases: ["capacity", "mah"],
    },
    {
      column: "cell_count",
      label: "Cells",
      type: "integer",
      min: 1,
      max: 24,
      aliases: ["cell count", "s", "series"],
    },
    {
      column: "baseline_cycles",
      label: "Cycles",
      type: "integer",
      min: 0,
      max: 5000,
      aliases: ["cycle count", "cycles used", "charge cycles"],
      hint: "Cycles before the portal; logged flights add to this",
    },
    {
      column: "cycle_limit",
      label: "Cycle limit",
      type: "integer",
      min: 1,
      max: 5000,
      aliases: ["max cycles", "rated cycles"],
    },
    {
      column: "status",
      label: "Status",
      type: "enum",
      options: ["serviceable", "monitor", "retired"],
      optionLabels: { serviceable: "Serviceable", monitor: "Monitor", retired: "Retired" },
      aliases: ["condition"],
    },
    {
      column: "purchased_date",
      label: "Purchased",
      type: "date",
      aliases: ["purchase date", "acquired", "in service"],
    },
    {
      column: "location_site",
      label: "Location",
      type: "text",
      aliases: ["site", "base", "stored at"],
    },
    { column: "notes", label: "Notes", type: "text" },
  ],
};

export const componentImport: ImportSchema = {
  entity: "components",
  label: "components",
  table: "components",
  naturalKey: "component_id",
  fields: [
    {
      column: "component_id",
      label: "Component ID",
      type: "text",
      required: true,
      aliases: ["part id", "part", "asset id"],
    },
    {
      column: "name",
      label: "Name",
      type: "text",
      required: true,
      aliases: ["description", "part name"],
    },
    {
      column: "category",
      label: "Category",
      type: "enum",
      required: true,
      options: [
        "motor",
        "propeller",
        "esc",
        "gimbal",
        "camera",
        "payload",
        "rtk_base",
        "controller",
        "antenna",
        "charger",
        "case",
        "other",
      ],
      aliases: ["type", "part type"],
      optionLabels: {
        motor: "Motor",
        propeller: "Propeller",
        esc: "ESC",
        gimbal: "Gimbal",
        camera: "Camera",
        payload: "Payload",
        rtk_base: "RTK base",
        controller: "Controller",
        antenna: "Antenna",
        charger: "Charger",
        case: "Case",
        other: "Other",
      },
    },
    { column: "manufacturer", label: "Manufacturer", type: "text", aliases: ["make", "brand"] },
    { column: "model", label: "Model", type: "text" },
    {
      column: "serial_number",
      label: "Serial number",
      type: "text",
      aliases: ["serial", "sn"],
    },
    {
      column: "baseline_hours",
      label: "Hours",
      type: "number",
      min: 0,
      max: MAX_AIRFRAME_HOURS,
      aliases: ["total hours", "hours used"],
      hint: "Hours before the portal; flights while fitted add to this",
    },
    {
      column: "service_interval_hours",
      label: "Service interval (hours)",
      type: "integer",
      min: 1,
      max: 5000,
      aliases: ["service interval", "interval hours", "life limit"],
    },
    {
      column: "status",
      label: "Status",
      type: "enum",
      options: ["in_service", "spare", "maintenance", "retired"],
      optionLabels: {
        in_service: "In service",
        spare: "Spare",
        maintenance: "In maintenance",
        retired: "Retired",
      },
      aliases: ["condition"],
    },
    {
      column: "purchased_date",
      label: "Purchased",
      type: "date",
      aliases: ["purchase date", "acquired"],
    },
    {
      column: "location_site",
      label: "Location",
      type: "text",
      aliases: ["site", "base", "stored at"],
    },
    { column: "notes", label: "Notes", type: "text" },
  ],
};

export const importSchemas = {
  pilots: pilotImport,
  uavs: uavImport,
  batteries: batteryImport,
  components: componentImport,
} as const;

export type ImportEntity = keyof typeof importSchemas;

export function schemaFor(entity: string): ImportSchema | null {
  return (importSchemas as Record<string, ImportSchema>)[entity] ?? null;
}
