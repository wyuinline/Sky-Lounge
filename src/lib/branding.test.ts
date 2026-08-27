import { describe, it, expect } from "vitest";
import {
  safeAccent,
  prefersDarkText,
  logoUrl,
  publicStorageUrl,
  DEFAULT_ACCENT,
} from "@/lib/branding";

describe("safeAccent", () => {
  it("accepts a six-digit hex colour and normalises its case", () => {
    expect(safeAccent("#C4E86C")).toBe("#c4e86c");
    expect(safeAccent("#000000")).toBe("#000000");
  });

  it("falls back rather than escaping anything questionable", () => {
    // The value is interpolated into a CSS custom property. Replacing is safe
    // in a way that escaping is only probably safe.
    expect(safeAccent(null)).toBe(DEFAULT_ACCENT);
    expect(safeAccent("")).toBe(DEFAULT_ACCENT);
    expect(safeAccent("red")).toBe(DEFAULT_ACCENT);
    expect(safeAccent("#fff")).toBe(DEFAULT_ACCENT);
    expect(safeAccent("#c4e86c; } body { display:none")).toBe(DEFAULT_ACCENT);
    expect(safeAccent("url(javascript:alert(1))")).toBe(DEFAULT_ACCENT);
  });
});

describe("prefersDarkText", () => {
  it("puts dark text on a pale accent", () => {
    expect(prefersDarkText("#ffffff")).toBe(true);
    expect(prefersDarkText("#c4e86c")).toBe(true);
  });

  it("puts light text on a dark accent", () => {
    // An operator picking navy should not end up with black on navy.
    expect(prefersDarkText("#000000")).toBe(false);
    expect(prefersDarkText("#1f3a93")).toBe(false);
    expect(prefersDarkText("#333f48")).toBe(false);
  });

  it("treats a colour it cannot read as the default", () => {
    expect(prefersDarkText("nonsense")).toBe(prefersDarkText(DEFAULT_ACCENT));
  });
});

describe("publicStorageUrl", () => {
  const BASE = "https://project.supabase.co";

  it("builds a URL under the bucket", () => {
    expect(publicStorageUrl(BASE, "organisation-logos", "org-id/logo.png")).toBe(
      `${BASE}/storage/v1/object/public/organisation-logos/org-id/logo.png`,
    );
  });

  it("encodes each segment without destroying the path", () => {
    // A space in a filename must not break the URL, and the separators must
    // survive as separators rather than becoming %2F.
    expect(publicStorageUrl(BASE, "b", "org-id/my logo.png")).toBe(
      `${BASE}/storage/v1/object/public/b/org-id/my%20logo.png`,
    );
  });

  it("does not double the slash when the base has a trailing one", () => {
    expect(publicStorageUrl(`${BASE}/`, "b", "x.png")).toBe(
      `${BASE}/storage/v1/object/public/b/x.png`,
    );
  });
});

describe("logoUrl", () => {
  it("returns nothing when there is no logo", () => {
    expect(logoUrl(null)).toBeNull();
    expect(logoUrl("")).toBeNull();
  });
});
