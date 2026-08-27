import { describe, it, expect } from "vitest";
import {
  readGraphConfig,
  safeFileName,
  mirrorPath,
  uploadRoute,
  planChunks,
  tokenIsFresh,
  tokenExpiry,
  isMirrorable,
  NEVER_MIRRORED,
  SHAREPOINT_FOLDERS,
  SIMPLE_UPLOAD_LIMIT,
  CHUNK_SIZE,
  TOKEN_SKEW_MS,
} from "@/lib/sharepoint";

const FULL_ENV = {
  AZURE_TENANT_ID: "tenant",
  AZURE_CLIENT_ID: "client",
  AZURE_CLIENT_SECRET: "secret",
  SHAREPOINT_SITE_ID: "site",
  SHAREPOINT_DRIVE_ID: "drive",
};

describe("readGraphConfig", () => {
  it("reads a complete configuration", () => {
    const result = readGraphConfig(FULL_ENV);
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.config.tenantId).toBe("tenant");
  });

  it("names every variable that is missing, not just the first", () => {
    // An administrator half way through an Azure app registration needs the
    // whole list, or they come back three times.
    const result = readGraphConfig({ AZURE_TENANT_ID: "tenant" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.missing).toEqual([
      "AZURE_CLIENT_ID",
      "AZURE_CLIENT_SECRET",
      "SHAREPOINT_SITE_ID",
      "SHAREPOINT_DRIVE_ID",
    ]);
  });

  it("treats a blank value as missing", () => {
    // A variable set to "" in a deploy dashboard is the commonest way this
    // half-configures, and it must not read as present.
    const result = readGraphConfig({ ...FULL_ENV, AZURE_CLIENT_SECRET: "   " });
    expect(result.ok === false && result.missing).toEqual(["AZURE_CLIENT_SECRET"]);
  });
});

describe("isMirrorable", () => {
  it("mirrors ordinary operational documents", () => {
    expect(isMirrorable("sop")).toBe(true);
    expect(isMirrorable("training_material")).toBe(true);
  });

  it("never mirrors restricted material", () => {
    // These are restricted in the portal by RLS. A SharePoint library has its
    // own permissions, changed by someone else without anyone here knowing.
    for (const category of NEVER_MIRRORED) {
      expect(isMirrorable(category)).toBe(false);
    }
    expect(NEVER_MIRRORED).toContain("incident_report");
    expect(NEVER_MIRRORED).toContain("regulatory");
    expect(NEVER_MIRRORED).toContain("roc_a");
  });

  it("has a folder for every category, mirrored or not", () => {
    // A category with no folder would throw at upload time rather than at
    // build time, on whichever document happened to use it first.
    for (const category of Object.keys(SHAREPOINT_FOLDERS)) {
      expect(SHAREPOINT_FOLDERS[category as keyof typeof SHAREPOINT_FOLDERS]).toBeTruthy();
    }
  });
});

describe("safeFileName", () => {
  it("leaves an ordinary name alone", () => {
    expect(safeFileName("Flight Operations Manual")).toBe("Flight Operations Manual");
  });

  it("replaces every character SharePoint rejects", () => {
    expect(safeFileName('a"b*c:d<e>f?g/h\\i|j#k%l')).toBe("a-b-c-d-e-f-g-h-i-j-k-l");
  });

  it("trims what SharePoint refuses at the edges", () => {
    expect(safeFileName("  spaced  ")).toBe("spaced");
    expect(safeFileName("trailing dots...")).toBe("trailing dots");
  });

  it("never returns an empty name", () => {
    // An empty segment makes Graph address the folder itself, which would
    // overwrite the folder rather than create a file in it. Whitespace and
    // full stops are stripped entirely, so those are the cases that reach zero.
    expect(safeFileName("   ")).toBe("document");
    expect(safeFileName("...")).toBe("document");
    // Rejected characters become hyphens, which is a legal name — no fallback.
    expect(safeFileName("///")).toBe("---");
  });

  it("keeps the name inside SharePoint's length limit", () => {
    expect(safeFileName("x".repeat(400))).toHaveLength(200);
  });
});

describe("mirrorPath", () => {
  it("files a document under its category folder", () => {
    expect(mirrorPath("sop", "Pre-flight Checks", "2.1", "checks.pdf")).toBe(
      "Standard Operating Procedures/Pre-flight Checks v2.1.pdf",
    );
  });

  it("omits the version when there is not one", () => {
    expect(mirrorPath("policy", "Privacy Policy", null, "policy.docx")).toBe(
      "Policies/Privacy Policy.docx",
    );
    expect(mirrorPath("policy", "Privacy Policy", "  ", "policy.docx")).toBe(
      "Policies/Privacy Policy.docx",
    );
  });

  it("normalises the extension and keeps only the last one", () => {
    expect(mirrorPath("safety_document", "Report", null, "archive.tar.PDF")).toBe(
      "Safety Documents/Report.pdf",
    );
  });

  it("copes with a file that has no extension at all", () => {
    expect(mirrorPath("training_material", "Notes", null, "README")).toBe(
      "Training Materials/Notes",
    );
  });

  it("sanitises a title that would break the path", () => {
    // A title with a slash would otherwise create an unintended subfolder.
    expect(mirrorPath("sop", "Battery / Charging", null, "x.pdf")).toBe(
      "Standard Operating Procedures/Battery - Charging.pdf",
    );
  });
});

describe("uploadRoute", () => {
  it("uses the simple upload up to Graph's 4 MB limit", () => {
    expect(uploadRoute(1024)).toBe("simple");
    expect(uploadRoute(SIMPLE_UPLOAD_LIMIT)).toBe("simple");
  });

  it("switches to a resumable session one byte over", () => {
    expect(uploadRoute(SIMPLE_UPLOAD_LIMIT + 1)).toBe("session");
  });
});

describe("planChunks", () => {
  it("covers the whole file exactly, with inclusive ranges", () => {
    const size = CHUNK_SIZE * 2 + 500;
    const chunks = planChunks(size);
    expect(chunks[0].start).toBe(0);
    expect(chunks.at(-1)?.end).toBe(size - 1);
    // No gaps and no overlaps between consecutive chunks.
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].start).toBe(chunks[i - 1].end + 1);
    }
  });

  it("formats Content-Range the way Graph requires", () => {
    const chunks = planChunks(100, 40);
    expect(chunks.map((c) => c.contentRange)).toEqual([
      "bytes 0-39/100",
      "bytes 40-79/100",
      "bytes 80-99/100",
    ]);
  });

  it("returns a single chunk for a file smaller than the chunk size", () => {
    expect(planChunks(10, 40)).toEqual([
      { start: 0, end: 9, contentRange: "bytes 0-9/10" },
    ]);
  });

  it("returns nothing for an empty file rather than a zero-length range", () => {
    expect(planChunks(0)).toEqual([]);
  });
});

describe("token freshness", () => {
  const now = 1_000_000;

  it("treats an absent token as stale", () => {
    expect(tokenIsFresh(null, now)).toBe(false);
  });

  it("uses a token with room to spare", () => {
    expect(tokenIsFresh(now + TOKEN_SKEW_MS + 1, now)).toBe(true);
  });

  it("refuses a token expiring inside the skew window", () => {
    // A token that dies mid-upload fails a 25 MB transfer halfway, which is
    // worse than fetching a new one a minute early.
    expect(tokenIsFresh(now + TOKEN_SKEW_MS, now)).toBe(false);
    expect(tokenIsFresh(now - 1, now)).toBe(false);
  });

  it("converts Graph's expires_in into an instant", () => {
    expect(tokenExpiry(3600, now)).toBe(now + 3_600_000);
  });
});
