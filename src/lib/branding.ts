/**
 * How an operator's own identity reaches the page.
 *
 * A firm that hands this portal to their own clients needs it to look like
 * theirs. What that means in practice is deliberately narrow: their name,
 * their mark, and one accent colour.
 *
 * The accent is the only colour they control. Text, backgrounds and the
 * good/warning/critical status colours are the portal's, because those carry
 * meaning and legibility that a colour picker should not be able to break —
 * an operator who chose pale yellow for "overdue" would have made their own
 * fleet unreadable.
 */

/** The portal's own accent, used by an operator who has not chosen one. */
export const DEFAULT_ACCENT = "#c4e86c";

/**
 * Builds the public URL for an object in a public bucket.
 *
 * Separated from the environment so it can be tested without one: a URL
 * builder that silently returns null when a variable is unset is exactly the
 * sort of thing that passes its tests and fails in production.
 *
 * Each path segment is encoded individually, so a space in a filename survives
 * as %20 while the separators survive as separators.
 */
export function publicStorageUrl(
  baseUrl: string,
  bucket: string,
  path: string,
): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

/**
 * The public URL of a logo in storage.
 *
 * The logo bucket is public on purpose — the mark is on every page, and a
 * signed URL per request for a decorative image is a round trip for nothing.
 */
export function logoUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return publicStorageUrl(base, "organisation-logos", path);
}

/**
 * Whether a colour is one we are willing to interpolate into a stylesheet.
 *
 * The database has the same constraint. This exists so a value that somehow
 * reached the page anyway cannot become a style injection: anything that is
 * not six hex digits is replaced rather than escaped, because there is no
 * legitimate accent colour that needs escaping.
 */
export function safeAccent(colour: string | null): string {
  if (colour && /^#[0-9a-fA-F]{6}$/.test(colour)) return colour.toLowerCase();
  return DEFAULT_ACCENT;
}

/**
 * Whether text on this colour should be dark.
 *
 * Relative luminance per WCAG, so a dark accent gets light text and a pale one
 * gets dark — an operator picking navy should not end up with black-on-navy
 * badges nobody can read.
 */
export function prefersDarkText(colour: string): boolean {
  const hex = safeAccent(colour).slice(1);
  const channel = (i: number) => {
    const value = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  // 0.45 rather than 0.5: the dark text in this palette is nearly black, so it
  // stays readable further down the range than white does going up.
  return luminance > 0.45;
}
