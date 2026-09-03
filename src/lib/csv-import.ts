/**
 * Bringing an existing fleet into the portal.
 *
 * Every operator arrives with their aircraft, crew, packs and parts already
 * recorded somewhere — a spreadsheet, usually. Retyping it is how a rollout
 * stalls, and worse, how a certificate expiry gets keyed a year out and nobody
 * notices until a flight is refused.
 *
 * So this parses whatever spreadsheet they have. The design principles, in
 * order of how much trouble they save:
 *
 * 1. **Nothing is written until the whole file has been read and judged.** The
 *    caller gets a row-by-row verdict to show before anything is committed.
 *    A half-imported fleet is worse than none.
 *
 * 2. **A value that cannot be understood is an error, never a guess.** The one
 *    exception is a date column whose format is genuinely ambiguous, and that
 *    is escalated to the person rather than decided here — see detectDateFormat.
 *
 * 3. **Column matching is forgiving; value coercion is strict.** "Drone ID",
 *    "drone_id" and "Aircraft ID" all find the same column, because a header is
 *    a label. "Airworthyish" is not a status, because a value is data.
 */

import { normaliseHeader, splitCsvLine } from "@/lib/telemetry";
import type { Database } from "@/lib/database.types";

/** A table an import may write to, typed so a rename breaks the build here. */
export type ImportTable = keyof Database["public"]["Tables"];

export type FieldType = "text" | "number" | "integer" | "date" | "enum" | "boolean";

export type FieldSpec = {
  /** The database column this fills. */
  column: string;
  /** What the person sees, in the preview and in the template. */
  label: string;
  type: FieldType;
  required?: boolean;
  /** Header spellings that mean this field, beyond the column and label. */
  aliases?: string[];
  /** For type "enum": the stored values, matched forgivingly. */
  options?: string[];
  /**
   * How the portal itself labels each option, which is therefore how someone
   * reading the portal will write it. "In maintenance" has to find
   * "maintenance", or a file exported from here cannot be imported back.
   */
  optionLabels?: Record<string, string>;
  /** Bounds for numbers, checked so a typo cannot become 5,000 flight hours. */
  min?: number;
  max?: number;
  /** Help text shown against the column in the template. */
  hint?: string;
};

export type ImportSchema = {
  entity: string;
  /** What the person calls these, in headings and messages. */
  label: string;
  table: ImportTable;
  fields: FieldSpec[];
  /**
   * The column that identifies a row as already present — a drone id, a serial
   * number. Duplicates are reported rather than merged: deciding that two rows
   * are the same aircraft is a judgement, not a parse.
   */
  naturalKey: string;
};

export type CellError = { column: string; message: string };

export type ParsedRow = {
  /** 1-based, counting the header, so it matches what the spreadsheet shows. */
  line: number;
  values: Record<string, string | number | boolean | null>;
  errors: CellError[];
  /** Set when this row repeats a natural key seen earlier in the same file. */
  duplicateOfLine: number | null;
};

export type DateFormat = "iso" | "dmy" | "mdy";

export type ParseResult = {
  rows: ParsedRow[];
  /** Fields the file had no column for, in schema order. */
  missingRequired: string[];
  /** Headers in the file that matched no field — usually harmless, worth saying. */
  unmatchedHeaders: string[];
  /** Which date reading was used, and whether the file could be read two ways. */
  dateFormat: DateFormat;
  dateAmbiguous: boolean;
  /** A whole-file failure. When set, `rows` is empty. */
  error: string | null;
};

/** Beyond this a spreadsheet is a database export and wants a different tool. */
export const MAX_IMPORT_ROWS = 5000;

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

/**
 * Matches a value against an enum, forgiving about how it was written.
 *
 * "Advanced Operations", "advanced-operations" and "ADVANCED_OPERATIONS" are
 * the same choice typed by three different people. Anything that still does not
 * match is an error rather than a default, because silently filing an aircraft
 * as airworthy when the sheet said something else is the worst outcome here.
 */
export function matchEnum(
  value: string,
  options: string[],
  labels: Record<string, string> = {},
): string | null {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = normalise(value);
  if (key === "") return null;

  const byValue = options.find((o) => normalise(o) === key);
  if (byValue) return byValue;

  // The label the portal shows for this option counts as the option: someone
  // typing what they read on screen is not making a mistake.
  return options.find((o) => labels[o] !== undefined && normalise(labels[o]) === key) ?? null;
}

/** Reads a number, tolerating thousands separators and a trailing unit. */
export function parseNumber(value: string): number | null {
  const cleaned = value
    .replace(/,/g, "")
    .replace(/[^0-9.+-]+$/, "")
    .trim();
  if (cleaned === "" || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "active", "x"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "inactive"]);

export function parseBoolean(value: string): boolean | null {
  const key = value.trim().toLowerCase();
  if (TRUE_WORDS.has(key)) return true;
  if (FALSE_WORDS.has(key)) return false;
  return null;
}

/** Splits a date into three numbers, whatever separator was used. */
function dateParts(value: string): number[] | null {
  const parts = value.trim().split(/[/\-.\s]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => Number(p));
  return nums.every((n) => Number.isInteger(n)) ? nums : null;
}

/**
 * Which way round a date column reads.
 *
 * The hard case is real: in Canada both 03/04/2026 conventions are in daily
 * use, and guessing wrong moves a certificate expiry by up to eleven months.
 * So the whole column is examined at once — one unambiguous value settles it
 * for every other — and if the column is ambiguous from top to bottom the
 * caller is told, so a person can decide rather than this function.
 */
export function detectDateFormat(values: string[]): {
  format: DateFormat;
  ambiguous: boolean;
} {
  let sawIso = false;
  let dayFirst = false;
  let monthFirst = false;

  for (const value of values) {
    const parts = dateParts(value);
    if (!parts) continue;
    const [a, b] = parts;

    // A four-digit leading number is a year: unambiguous.
    if (a > 31) {
      sawIso = true;
      continue;
    }
    if (a > 12) dayFirst = true;
    if (b > 12) monthFirst = true;
  }

  if (dayFirst && !monthFirst) return { format: "dmy", ambiguous: false };
  if (monthFirst && !dayFirst) return { format: "mdy", ambiguous: false };
  if (sawIso && !dayFirst && !monthFirst) return { format: "iso", ambiguous: false };

  // Either nothing distinguishing was found, or the column contradicts itself.
  // Day-first is the Canadian default and is the safer of the two to assume,
  // but the caller is told it was a guess.
  return { format: "dmy", ambiguous: true };
}

/** Turns a date into the ISO form Postgres wants, or null if it is not one. */
export function parseDate(value: string, format: DateFormat): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parts = dateParts(trimmed);
  if (!parts) return null;

  const [a, b, c] = parts;
  let year: number;
  let month: number;
  let day: number;

  if (a > 31) {
    // Leading four-digit year, whatever the file's overall format.
    [year, month, day] = [a, b, c];
  } else if (format === "mdy") {
    [month, day, year] = [a, b, c];
  } else {
    [day, month, year] = [a, b, c];
  }

  // Two-digit years: a fleet document is about the present, so 26 is 2026 and
  // 98 is 1998 — the same window every spreadsheet uses.
  if (year < 100) year += year < 70 ? 2000 : 1900;

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

  // Catches the 31st of February, which passes the range checks above.
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== day) return null;

  return iso;
}

// ---------------------------------------------------------------------------
// Parsing a file against a schema
// ---------------------------------------------------------------------------

/** Every spelling of a header that should find this field. */
function headerKeys(field: FieldSpec): string[] {
  return [field.column, field.label, ...(field.aliases ?? [])].map(normaliseHeader);
}

/** Maps each schema field to the column index that fills it, or -1. */
export function matchColumns(headers: string[], schema: ImportSchema): Map<string, number> {
  const normalised = headers.map(normaliseHeader);
  const matched = new Map<string, number>();

  for (const field of schema.fields) {
    const keys = headerKeys(field);
    const index = normalised.findIndex((h) => h !== "" && keys.includes(h));
    if (index !== -1) matched.set(field.column, index);
  }
  return matched;
}

function coerce(
  raw: string,
  field: FieldSpec,
  dateFormat: DateFormat,
): { value: string | number | boolean | null; error: string | null } {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return field.required
      ? { value: null, error: `${field.label} is required` }
      : { value: null, error: null };
  }

  switch (field.type) {
    case "text":
      return { value: trimmed, error: null };

    case "enum": {
      const matchedValue = matchEnum(trimmed, field.options ?? [], field.optionLabels);
      if (matchedValue !== null) return { value: matchedValue, error: null };

      // The accepted values are named in full, because "not a valid status" is
      // useless to someone looking at a spreadsheet of two hundred rows.
      const accepted = (field.options ?? []).map((o) => field.optionLabels?.[o] ?? o);
      return {
        value: null,
        error: `"${trimmed}" is not one of: ${accepted.join(", ")}`,
      };
    }

    case "boolean": {
      const parsed = parseBoolean(trimmed);
      return parsed === null
        ? { value: null, error: `"${trimmed}" is not a yes or no` }
        : { value: parsed, error: null };
    }

    case "date": {
      const iso = parseDate(trimmed, dateFormat);
      return iso === null
        ? { value: null, error: `"${trimmed}" is not a date` }
        : { value: iso, error: null };
    }

    case "number":
    case "integer": {
      const n = parseNumber(trimmed);
      if (n === null) return { value: null, error: `"${trimmed}" is not a number` };
      if (field.type === "integer" && !Number.isInteger(n)) {
        return { value: null, error: `${field.label} must be a whole number` };
      }
      // Bounds catch the transposed digit that would otherwise become 5,000
      // flight hours and skew every derived figure downstream.
      if (field.min !== undefined && n < field.min) {
        return { value: null, error: `${field.label} cannot be below ${field.min}` };
      }
      if (field.max !== undefined && n > field.max) {
        return { value: null, error: `${field.label} cannot be above ${field.max}` };
      }
      return { value: n, error: null };
    }
  }
}

/**
 * Reads a whole file into rows with a verdict on each.
 *
 * Nothing here writes anything. The caller shows the result, the person looks
 * at it, and only then is anything committed — which is the only way an import
 * of somebody's entire fleet is safe to offer.
 */
export function parseImport(
  text: string,
  schema: ImportSchema,
  forcedDateFormat?: DateFormat,
): ParseResult {
  const empty: ParseResult = {
    rows: [],
    missingRequired: [],
    unmatchedHeaders: [],
    dateFormat: forcedDateFormat ?? "iso",
    dateAmbiguous: false,
    error: null,
  };

  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) return { ...empty, error: "That file is empty." };
  if (lines.length === 1) {
    return { ...empty, error: "That file has a header row but no data under it." };
  }
  if (lines.length - 1 > MAX_IMPORT_ROWS) {
    return {
      ...empty,
      error: `That file has ${(lines.length - 1).toLocaleString()} rows. Import at most ${MAX_IMPORT_ROWS.toLocaleString()} at a time.`,
    };
  }

  const headers = splitCsvLine(lines[0]);
  const matched = matchColumns(headers, schema);

  const missingRequired = schema.fields
    .filter((f) => f.required && !matched.has(f.column))
    .map((f) => f.label);

  if (missingRequired.length > 0) {
    return {
      ...empty,
      missingRequired,
      error: `The file has no column for ${missingRequired.join(" or ")}. Add ${
        missingRequired.length === 1 ? "it" : "them"
      } and try again.`,
    };
  }

  const usedIndices = new Set(matched.values());
  const unmatchedHeaders = headers.filter(
    (h, i) => h.trim() !== "" && !usedIndices.has(i),
  );

  const body = lines.slice(1).map(splitCsvLine);

  // The date format is decided once for the whole file, from every date column
  // at once: a file is written by one person in one convention.
  const dateFields = schema.fields.filter((f) => f.type === "date" && matched.has(f.column));
  const dateSamples = dateFields.flatMap((f) => {
    const index = matched.get(f.column) as number;
    return body.map((cells) => cells[index] ?? "").filter((v) => v.trim() !== "");
  });

  const detected = detectDateFormat(dateSamples);
  const dateFormat = forcedDateFormat ?? detected.format;
  const dateAmbiguous = forcedDateFormat === undefined && detected.ambiguous && dateSamples.length > 0;

  const seen = new Map<string, number>();
  const rows: ParsedRow[] = body.map((cells, i) => {
    const line = i + 2;
    const values: ParsedRow["values"] = {};
    const errors: CellError[] = [];

    for (const field of schema.fields) {
      const index = matched.get(field.column);
      const raw = index === undefined ? "" : (cells[index] ?? "");
      const { value, error } = coerce(raw, field, dateFormat);
      if (error) errors.push({ column: field.label, message: error });
      if (value !== null) values[field.column] = value;
    }

    // Reported, not merged: deciding two rows are the same aircraft is a
    // judgement the person importing has to make.
    const key = String(values[schema.naturalKey] ?? "").toLowerCase();
    let duplicateOfLine: number | null = null;
    if (key !== "") {
      const first = seen.get(key);
      if (first !== undefined) duplicateOfLine = first;
      else seen.set(key, line);
    }

    return { line, values, errors, duplicateOfLine };
  });

  return {
    rows,
    missingRequired: [],
    unmatchedHeaders,
    dateFormat,
    dateAmbiguous,
    error: null,
  };
}

/** The rows worth writing: no errors, and not a repeat of an earlier one. */
export function importableRows(rows: ParsedRow[]): ParsedRow[] {
  return rows.filter((r) => r.errors.length === 0 && r.duplicateOfLine === null);
}

export type ImportSummary = {
  total: number;
  ready: number;
  withErrors: number;
  duplicates: number;
};

export function summariseImport(rows: ParsedRow[]): ImportSummary {
  return {
    total: rows.length,
    ready: importableRows(rows).length,
    withErrors: rows.filter((r) => r.errors.length > 0).length,
    duplicates: rows.filter((r) => r.duplicateOfLine !== null && r.errors.length === 0).length,
  };
}

/** A blank file with the right headers, for anyone who has nothing to start from. */
export function templateCsv(schema: ImportSchema): string {
  const headers = schema.fields.map((f) => f.label);
  const hints = schema.fields.map((f) => {
    if (f.type === "enum") {
      return (f.options ?? []).map((o) => f.optionLabels?.[o] ?? o).join(" | ");
    }
    if (f.type === "date") return "yyyy-mm-dd";
    if (f.required) return "required";
    return f.hint ?? "";
  });

  // A UTF-8 BOM, so Excel on Windows reads accented crew names correctly.
  return `﻿${headers.join(",")}\r\n${hints.map((h) => (h.includes(",") ? `"${h}"` : h)).join(",")}\r\n`;
}
