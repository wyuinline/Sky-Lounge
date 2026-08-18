import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /**
   * Only build-time static assets are exempt. An earlier version excluded any
   * path *ending* in an image extension, which meant a route like
   * /reports/summary.png would skip the auth redirect entirely — files under
   * /public are served before the proxy anyway, so the exemption bought
   * nothing and opened a bypass.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
