import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Paths that must resolve without a session.
 *
 * A service worker is fetched by the browser with no cookies attached, the
 * manifest is read the same way when a phone installs the app, and the offline
 * page is what the worker shows when there is no network to authenticate
 * against — redirecting any of them to /login makes offline capture impossible.
 *
 * Exact paths, matched as a set. An earlier exemption here matched by file
 * extension, which meant any route could bypass auth by ending in one.
 */
const UNAUTHENTICATED_PATHS = new Set([
  "/offline",
  "/sw.js",
  "/manifest.webmanifest",
  "/icon.svg",
]);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token if expired — required for Server Components,
  // which cannot set cookies themselves.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // API routes authenticate themselves — the scheduled reminders job carries a
  // bearer secret, not a session cookie. Redirecting them to /login would turn
  // every unauthenticated API call into a silent 307 to an HTML page.
  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  if (UNAUTHENTICATED_PATHS.has(pathname)) {
    return supabaseResponse;
  }

  // The landing point for emailed invite and password-reset links. It has to be
  // reachable while signed out — that is the whole point of it — and it does its
  // own verification, redirecting to /login when the token is expired or used.
  if (pathname === "/auth/confirm") {
    return supabaseResponse;
  }

  if (!user && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
