"use server";

import { createClient } from "@/lib/supabase/server";

function authCallbackUrl(next: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/**
 * Starts a self-serve password reset.
 *
 * Always reports success, whether or not the address has an account. Saying
 * "no such user" would turn this form into a way to test which of a company's
 * email addresses are registered.
 */
export async function requestPasswordReset(email: string) {
  const address = email.trim().toLowerCase();
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(address, {
    redirectTo: authCallbackUrl("/auth/update-password"),
  });

  if (error) {
    console.error("[password reset request]", error);
    if (error.status === 429) {
      return { error: "A link was requested recently. Wait a minute and try again." };
    }
  }

  return { error: null };
}
