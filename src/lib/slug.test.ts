import { describe, it, expect } from "vitest";
import { slugify, isValidSlug } from "@/lib/slug";

describe("slugify", () => {
  it("turns a company name into an address", () => {
    expect(slugify("Inline Group Inc.")).toBe("inline-group-inc");
    expect(slugify("Northern Survey & Mapping")).toBe("northern-survey-mapping");
  });

  it("folds accents rather than dropping the letter", () => {
    // "a-rospatiale" would be an address nobody could guess or read aloud.
    expect(slugify("Aérospatiale")).toBe("aerospatiale");
    expect(slugify("Ørsted Survey")).toBe("rsted-survey");
  });

  it("never starts or ends with a hyphen", () => {
    expect(slugify("  ...Acme...  ")).toBe("acme");
    expect(slugify("!!!")).toBe("");
  });

  it("collapses runs of punctuation into a single hyphen", () => {
    expect(slugify("A — B // C")).toBe("a-b-c");
  });

  it("stays inside the length the database accepts, without a trailing hyphen", () => {
    // Slicing mid-word can leave the hyphen exposed, which the check
    // constraint would then reject.
    const long = slugify(`${"a".repeat(62)} bcdef`);
    expect(long.length).toBeLessThanOrEqual(63);
    expect(long.endsWith("-")).toBe(false);
    expect(isValidSlug(long)).toBe(true);
  });
});

describe("isValidSlug", () => {
  it("accepts what slugify produces for a real name", () => {
    expect(isValidSlug(slugify("Inline Group"))).toBe(true);
  });

  it("rejects what the database would reject", () => {
    expect(isValidSlug("")).toBe(false);
    // Single characters are too short to be a usable address.
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("Has Capitals")).toBe(false);
    expect(isValidSlug("under_score")).toBe(false);
    expect(isValidSlug("a".repeat(64))).toBe(false);
  });

  it("accepts a slug at exactly the maximum length", () => {
    expect(isValidSlug("a".repeat(63))).toBe(true);
  });
});
