/**
 * Authenticating a read-API request.
 *
 * Split from the route so the policy is in one place and the routes stay thin.
 * The lookup uses the service-role client on purpose: RLS on api_keys is keyed
 * to a signed-in user manager, and an API request has no session at all.
 */

import "server-only";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readKeyFromHeaders,
  looksLikeKey,
  hashKey,
  authoriseKey,
  keyValidity,
  type ApiScope,
} from "@/lib/api-keys";

export type AuthResult =
  | { ok: true; keyId: string; scopes: string[]; organisationId: string }
  | { ok: false; status: 401 | 403 | 500; reason: string };

/**
 * Verifies the key on a request, optionally against a scope.
 *
 * `last_used_at` is written without awaiting the result: it is a convenience
 * for spotting dead integrations, and a failed write of it must not fail an
 * otherwise good request.
 */
export async function authenticateKey(
  request: NextRequest,
  area?: ApiScope,
): Promise<AuthResult> {
  const presented = readKeyFromHeaders(request.headers);
  if (presented === null) {
    return { ok: false, status: 401, reason: "Provide an API key as a bearer token." };
  }
  // Checking the shape first means a malformed value never becomes a database
  // round trip, so the endpoint cannot be used to probe timing.
  if (!looksLikeKey(presented)) {
    return { ok: false, status: 401, reason: "Unknown API key." };
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return { ok: false, status: 500, reason: "The API is not configured on this deployment." };
  }

  const hash = await hashKey(presented);
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, scopes, revoked_at, expires_at, organisation_id")
    .eq("key_hash", hash)
    .maybeSingle();

  const now = new Date().toISOString();
  // With no area given this is the index: prove the key is live, but do not
  // gate on scope — the index exists to tell a key what it would need.
  const verdict =
    area === undefined ? keyValidity(key, now) : authoriseKey(key, area, now);
  if (!verdict.ok) return { ok: false, status: verdict.status, reason: verdict.reason };
  if (key === null) return { ok: false, status: 401, reason: "Unknown API key." };

  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(undefined, () => undefined);

  // The key's organisation, and the only thing the routes may scope by. This
  // path runs on the service role, so RLS is not doing the scoping here — the
  // filter the caller applies with this value is.
  return { ok: true, keyId: key.id, scopes: key.scopes, organisationId: key.organisation_id };
}
