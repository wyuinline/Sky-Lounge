/**
 * API keys for the read API.
 *
 * The portal is the system of record for a fleet, and the figures it derives —
 * hours, currency, service intervals — are wanted elsewhere: a Power BI board,
 * an accounting export, a client's own dashboard. Handing those out through a
 * key is far better than handing out a login.
 *
 * Two rules shape everything here. A key is stored only as a hash, so a copy of
 * the database is not a set of working credentials; and a key grants *read*,
 * never write, because an integration that can file a flight is an integration
 * that can corrupt the record with nobody's name against it.
 */

import { accessAreaOrder, type AccessArea } from "@/lib/access";

/** Distinguishes a portal key at a glance in a log or a config file. */
export const KEY_PREFIX = "uavops_";
/** Bytes of entropy behind the prefix. 32 bytes is 256 bits. */
const KEY_BYTES = 32;
/** Kept in clear so a key can be named in the UI without storing the secret. */
export const HINT_LENGTH = 8;

/**
 * The areas a key may be granted.
 *
 * Narrower than the portal's own access areas: offering a scope with no
 * resource behind it would let someone tick a box that grants nothing, and
 * user management and the permissions matrix are not things an integration has
 * any business reading. A test keeps this in step with api-resources.ts.
 */
export const apiScopes: AccessArea[] = accessAreaOrder.filter((area) =>
  ["fleet", "maintenance", "pilots", "logs", "incidents", "docs_general"].includes(area),
);

export type ApiScope = AccessArea;

/** A newly minted key. The secret exists only in this object, once. */
export type MintedKey = {
  /** Shown to the person once, never stored. */
  secret: string;
  /** Stored, and used to look the key up on each request. */
  hash: string;
  /** The visible fragment, for telling one key from another later. */
  hint: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hashes a key for storage and lookup.
 *
 * Plain SHA-256, deliberately: unlike a password, an API key is full-entropy
 * random, so there is no dictionary to attack and no reason to pay bcrypt's
 * cost on every single request.
 */
export async function hashKey(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return toHex(new Uint8Array(digest));
}

/** Generates a key. The secret is returned once and never recoverable after. */
export async function mintKey(): Promise<MintedKey> {
  const bytes = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(bytes);
  const secret = `${KEY_PREFIX}${toHex(bytes)}`;
  return { secret, hash: await hashKey(secret), hint: keyHint(secret) };
}

/** The fragment of a key kept in clear, for identifying it in a list. */
export function keyHint(secret: string): string {
  return secret.slice(KEY_PREFIX.length, KEY_PREFIX.length + HINT_LENGTH);
}

/** Whether a string is even shaped like one of our keys. */
export function looksLikeKey(value: string): boolean {
  if (!value.startsWith(KEY_PREFIX)) return false;
  const body = value.slice(KEY_PREFIX.length);
  return body.length === KEY_BYTES * 2 && /^[0-9a-f]+$/.test(body);
}

/**
 * Pulls the key out of a request's headers.
 *
 * Both forms are accepted because both are what people reach for: `Authorization:
 * Bearer` is the convention, and `X-API-Key` is what most BI tools offer in
 * their connector dialog.
 */
export function readKeyFromHeaders(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return headers.get("x-api-key")?.trim() || null;
}

export type StoredKey = {
  id: string;
  scopes: string[];
  revoked_at: string | null;
  expires_at: string | null;
};

export type KeyVerdict =
  | { ok: true }
  | { ok: false; status: 401 | 403; reason: string };

/**
 * Whether a key is live at all — known, not revoked, not expired.
 *
 * Every failure here is a 401: the caller should stop and get a new key, and
 * telling them which of the three it was gives away nothing they cannot
 * already work out.
 */
export function keyValidity(key: StoredKey | null, now: string): KeyVerdict {
  if (key === null) return { ok: false, status: 401, reason: "Unknown API key." };
  if (key.revoked_at !== null) {
    return { ok: false, status: 401, reason: "This API key has been revoked." };
  }
  if (key.expires_at !== null && key.expires_at <= now) {
    return { ok: false, status: 401, reason: "This API key has expired." };
  }
  return { ok: true };
}

/**
 * Whether a key may serve a request for an area.
 *
 * Validity is checked first, so a revoked key is never told which scopes it
 * would have had. A live key asking outside its scope gets a 403 rather than a
 * 401: the caller is who they claim to be, swapping keys will not help, and
 * naming the missing scope is what lets them ask for the right one.
 */
export function authoriseKey(key: StoredKey | null, area: ApiScope, now: string): KeyVerdict {
  const validity = keyValidity(key, now);
  if (!validity.ok || key === null) return validity;
  if (!key.scopes.includes(area)) {
    return { ok: false, status: 403, reason: `This API key does not have the "${area}" scope.` };
  }
  return { ok: true };
}

/** Clamps a caller-supplied page size to something the database can serve. */
export const MAX_PAGE_SIZE = 500;
export const DEFAULT_PAGE_SIZE = 100;

export function parsePageSize(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

export function parseOffset(raw: string | null): number {
  if (raw === null || raw.trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}
