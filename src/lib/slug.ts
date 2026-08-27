/**
 * Turning an operator's name into a web address.
 *
 * A slug appears in URLs and in storage paths, so it is deliberately narrow:
 * lowercase letters, digits and hyphens, nothing else. It also has to survive
 * being typed out over the phone.
 *
 * In a plain module rather than beside the action that uses it, because a
 * "use server" file may only export async functions — and because the rule is
 * worth testing without a database.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    // Strip the accents NFKD just separated, so "Aérospatiale" becomes
    // "aerospatiale" rather than "a-rospatiale".
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    // A trailing hyphen can reappear after the slice.
    .replace(/-+$/, "");
}

/** Whether a slug is one the database will accept. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(slug);
}
