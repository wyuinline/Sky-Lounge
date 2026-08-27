/**
 * Where invite and recovery links land.
 *
 * Supabase appends its own query string, and the address must also be listed
 * under Auth → URL Configuration → Redirect URLs in the Supabase dashboard, or
 * it silently falls back to the project's Site URL.
 *
 * Shared rather than duplicated: both the per-operator invite and the
 * platform's first-administrator invite send people to the same place, and two
 * copies of this would eventually disagree about where that is.
 */
export function authCallbackUrl(next: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base}/auth/confirm?next=${encodeURIComponent(next)}`;
}
