import { NextResponse, type NextRequest } from "next/server";
import { describeApi } from "@/lib/api-resources";
import { authenticateKey } from "@/lib/api-auth";

/**
 * The index. A key holder hits this first to find out what they can read,
 * which beats a README that drifts from the code.
 *
 * Authenticated, because the list of resources is itself a description of the
 * operation. Scope is not checked here — the list names the scope each
 * resource needs, so a key can see what it would have to be granted.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateKey(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  return NextResponse.json(describeApi());
}
