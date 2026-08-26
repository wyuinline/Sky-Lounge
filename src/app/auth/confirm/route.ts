import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where every emailed auth link lands: invitations, password resets, and email
 * confirmations.
 *
 * Supabase sends a one-time token in the query string. Exchanging it here — on
 * the server, where the session cookie can actually be written — is what signs
 * the person in. Doing it client-side would leave the token in the browser
 * history and in any referrer sent onward.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  // Only ever redirect within this site. `next` arrives from a link in an
  // email, so treating it as a full URL would make this an open redirect.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error("[auth/confirm]", error);
    // Overwhelmingly this is an expired or already-used link, which is worth
    // saying plainly rather than dumping someone at a blank login form.
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
