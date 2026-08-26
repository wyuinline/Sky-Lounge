import { describe, it, expect } from "vitest";
import { csvField, csvRow, toCsv, csvFilename } from "@/lib/csv";

describe("csvField", () => {
  it("leaves ordinary text alone", () => {
    expect(csvField("UAV-001")).toBe("UAV-001");
  });

  it("quotes a field containing a comma", () => {
    expect(csvField("Acheson pit, north cell")).toBe('"Acheson pit, north cell"');
  });

  it("doubles inner quotes and wraps the field", () => {
    expect(csvField('He said "clear"')).toBe('"He said ""clear"""');
  });

  it("quotes a field containing a newline", () => {
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("quotes leading and trailing whitespace so it survives the round trip", () => {
    expect(csvField(" padded ")).toBe('" padded "');
  });

  it("renders an empty string for null and undefined, not the word null", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("renders booleans as words a person can read", () => {
    expect(csvField(true)).toBe("Yes");
    expect(csvField(false)).toBe("No");
  });

  it("keeps zero rather than treating it as empty", () => {
    expect(csvField(0)).toBe("0");
  });

  it("defuses a formula so a spreadsheet cannot execute it", () => {
    // A note reading "=HYPERLINK(...)" is a live injection into whoever opens
    // the export in Excel or Sheets.
    expect(csvField("=1+1")).toBe("'=1+1");
    expect(csvField("+44 7700 900000")).toBe("'+44 7700 900000");
    expect(csvField("-5 degrees")).toBe("'-5 degrees");
    expect(csvField("@channel")).toBe("'@channel");
  });

  it("defuses a formula that also needs quoting", () => {
    expect(csvField("=SUM(A1,A2)")).toBe(`"'=SUM(A1,A2)"`);
  });
});

describe("csvRow", () => {
  it("joins fields with commas", () => {
    expect(csvRow(["a", 1, true, null])).toBe("a,1,Yes,");
  });
});

describe("toCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    const out = toCsv(["ID", "Hours"], [["UAV-001", 41.5]]);
    expect(out).toBe("﻿ID,Hours\r\nUAV-001,41.5\r\n");
  });

  it("starts with a byte order mark so Excel reads UTF-8", () => {
    // Without it, Windows Excel renders accented crew names as mojibake.
    expect(toCsv(["Name"], [["Zoë Fontaine"]]).startsWith("﻿")).toBe(true);
  });

  it("still produces a usable file with no rows", () => {
    expect(toCsv(["ID"], [])).toBe("﻿ID\r\n");
  });
});

describe("csvFilename", () => {
  it("builds a name that sorts by date", () => {
    expect(csvFilename("flight-log", "2026-08-26")).toBe("sky-lounge-flight-log-2026-08-26.csv");
  });

  it("strips anything unsafe from the report id", () => {
    expect(csvFilename("Pilot Currency/2026", "2026-08-26")).toBe(
      "sky-lounge-pilot-currency-2026-2026-08-26.csv",
    );
  });
});
