import { describe, it, expect } from "vitest";
import {
  mintKey,
  hashKey,
  keyHint,
  looksLikeKey,
  readKeyFromHeaders,
  authoriseKey,
  parsePageSize,
  parseOffset,
  KEY_PREFIX,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  type StoredKey,
} from "@/lib/api-keys";

function stored(over: Partial<StoredKey> = {}): StoredKey {
  return { id: "k1", scopes: ["logs"], revoked_at: null, expires_at: null, ...over };
}

const NOW = "2026-08-26T12:00:00.000Z";

describe("mintKey", () => {
  it("produces a key that hashes to the stored hash", async () => {
    const key = await mintKey();
    expect(await hashKey(key.secret)).toBe(key.hash);
  });

  it("never returns the same secret twice", async () => {
    const [a, b] = await Promise.all([mintKey(), mintKey()]);
    expect(a.secret).not.toBe(b.secret);
  });

  it("stores a hint that matches the start of the secret", async () => {
    const key = await mintKey();
    expect(key.secret.startsWith(`${KEY_PREFIX}${key.hint}`)).toBe(true);
    // The hint must not be enough to reconstruct the key.
    expect(key.hint.length).toBeLessThan(key.secret.length - KEY_PREFIX.length);
  });
});

describe("looksLikeKey", () => {
  it("accepts a minted key", async () => {
    expect(looksLikeKey((await mintKey()).secret)).toBe(true);
  });

  it("rejects near misses", () => {
    expect(looksLikeKey("")).toBe(false);
    expect(looksLikeKey("sk_live_abc")).toBe(false);
    expect(looksLikeKey(`${KEY_PREFIX}tooshort`)).toBe(false);
    // A hash is the right length but not lowercase hex all the way through.
    expect(looksLikeKey(`${KEY_PREFIX}${"Z".repeat(64)}`)).toBe(false);
  });
});

describe("readKeyFromHeaders", () => {
  it("reads a bearer token", () => {
    const headers = new Headers({ authorization: "Bearer uavops_abc" });
    expect(readKeyFromHeaders(headers)).toBe("uavops_abc");
  });

  it("reads the header BI connectors offer instead", () => {
    expect(readKeyFromHeaders(new Headers({ "x-api-key": "uavops_abc" }))).toBe("uavops_abc");
  });

  it("returns null rather than an empty string", () => {
    expect(readKeyFromHeaders(new Headers({ authorization: "Bearer   " }))).toBeNull();
    expect(readKeyFromHeaders(new Headers())).toBeNull();
  });

  it("ignores a scheme it does not understand", () => {
    // Basic auth here would be a password, and treating it as a key would put
    // a credential into the key lookup path.
    expect(readKeyFromHeaders(new Headers({ authorization: "Basic dXNlcjpwYXNz" }))).toBeNull();
  });
});

describe("authoriseKey", () => {
  it("lets a live, scoped key through", () => {
    expect(authoriseKey(stored(), "logs", NOW)).toEqual({ ok: true });
  });

  it("refuses an unknown key without saying why it is unknown", () => {
    const verdict = authoriseKey(null, "logs", NOW);
    expect(verdict).toEqual({ ok: false, status: 401, reason: "Unknown API key." });
  });

  it("refuses a revoked key", () => {
    const verdict = authoriseKey(stored({ revoked_at: NOW }), "logs", NOW);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.status).toBe(401);
  });

  it("treats the expiry instant as already expired", () => {
    const verdict = authoriseKey(stored({ expires_at: NOW }), "logs", NOW);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain("expired");
  });

  it("still honours a key whose expiry is in the future", () => {
    expect(authoriseKey(stored({ expires_at: "2027-01-01T00:00:00.000Z" }), "logs", NOW).ok).toBe(
      true,
    );
  });

  it("separates 'not you' from 'not allowed'", () => {
    // A valid key asking for something outside its scope is a 403: the caller
    // is who they claim to be, and swapping keys will not help.
    const verdict = authoriseKey(stored({ scopes: ["logs"] }), "pilots", NOW);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.status).toBe(403);
    expect(verdict.ok === false && verdict.reason).toContain("pilots");
  });

  it("checks validity before scope", () => {
    // A revoked key must not be told which scopes it would have had.
    const verdict = authoriseKey(stored({ scopes: [], revoked_at: NOW }), "pilots", NOW);
    expect(verdict.ok === false && verdict.status).toBe(401);
  });
});

describe("paging", () => {
  it("defaults when nothing is asked for", () => {
    expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
    expect(parseOffset(null)).toBe(0);
  });

  it("caps a page size the database should not be asked for", () => {
    expect(parsePageSize("100000")).toBe(MAX_PAGE_SIZE);
  });

  it("falls back rather than failing on nonsense", () => {
    expect(parsePageSize("-5")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("abc")).toBe(DEFAULT_PAGE_SIZE);
    expect(parseOffset("-1")).toBe(0);
    expect(parseOffset("1.5")).toBe(0);
  });
});

describe("keyHint", () => {
  it("is stable for a given secret", () => {
    expect(keyHint(`${KEY_PREFIX}0123456789abcdef`)).toBe("01234567");
  });
});

describe("scope catalogue", () => {
  it("offers a scope for every resource the API serves, and no more", async () => {
    // A tickable scope with no resource behind it grants nothing; a resource
    // whose scope cannot be granted is unreachable. Either is a silent bug.
    const { apiResources } = await import("@/lib/api-resources");
    const { apiScopes } = await import("@/lib/api-keys");
    const needed = new Set(apiResources.map((r) => r.scope));
    expect(new Set(apiScopes)).toEqual(needed);
  });
});
