/**
 * CSV generation.
 *
 * Small enough to look trivial and quite capable of corrupting a regulator's
 * copy of the flight register if it is wrong: a site name containing a comma,
 * a note containing a quote, or an ID beginning with "=" all break a naive
 * join. Kept pure and tested for that reason.
 */

export type CsvValue = string | number | boolean | null | undefined;

/**
 * Escapes one field.
 *
 * Anything containing a comma, quote, newline or leading whitespace is quoted,
 * and inner quotes are doubled per RFC 4180.
 *
 * Fields starting with =, +, - or @ are prefixed with a single quote. Excel
 * and Sheets treat those as formulas, so a note reading "=cmd" is a live
 * injection into whoever opens the export. The prefix is the standard defence
 * and is invisible in the cell.
 */
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  let text = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (/[",\n\r]/.test(text) || /^\s|\s$/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(values: CsvValue[]): string {
  return values.map(csvField).join(",");
}

/**
 * A complete CSV document.
 *
 * Prefixed with a UTF-8 byte order mark: without it Excel on Windows reads the
 * file as the system codepage and mangles every accented name in the crew list.
 */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** A filename that is safe on every platform and sorts by date. */
export function csvFilename(reportId: string, today: string): string {
  const safe = reportId.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `sky-lounge-${safe}-${today}.csv`;
}
