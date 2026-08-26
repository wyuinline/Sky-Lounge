/**
 * Review-cycle vocabulary, shared by the upload form and the documents table.
 *
 * The cycle itself is stored per document; these are the choices offered, and
 * the words used for them. "Never" is a real, deliberate answer — a ROC-A
 * radio certificate does not expire and a filed incident report does not go
 * stale — so it is an option rather than an empty field.
 */

/** Sentinel for the select, since a select cannot hold null. */
export const NEVER_REVIEW = "never";

export const reviewCycleOptions: { value: string; label: string }[] = [
  { value: "6", label: "Every 6 months" },
  { value: "12", label: "Every year" },
  { value: "24", label: "Every 2 years" },
  { value: "36", label: "Every 3 years" },
  { value: NEVER_REVIEW, label: "Never — no review needed" },
];

export function reviewCycleLabel(months: number | null): string {
  if (!months) return "No review";
  const match = reviewCycleOptions.find((o) => o.value === String(months));
  return match ? match.label : `Every ${months} months`;
}

/** Compact form for a table cell, where the full phrase is too wide. */
export function reviewCycleShort(months: number | null): string {
  if (!months) return "—";
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "1 yr" : `${years} yrs`;
  }
  return `${months} mo`;
}
