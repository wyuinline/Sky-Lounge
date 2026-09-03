import { describe, it, expect } from "vitest";
import {
  matchEnum,
  parseNumber,
  parseBoolean,
  parseDate,
  detectDateFormat,
  matchColumns,
  parseImport,
  importableRows,
  summariseImport,
  templateCsv,
  MAX_IMPORT_ROWS,
} from "@/lib/csv-import";
import { pilotImport, uavImport, importSchemas } from "@/lib/import-schemas";

describe("matchEnum", () => {
  const options = ["basic_operations", "advanced_operations", "level_1_complex"];

  it("accepts the stored value", () => {
    expect(matchEnum("advanced_operations", options)).toBe("advanced_operations");
  });

  it("accepts how a person would actually type it", () => {
    // Three people, three conventions, one choice.
    expect(matchEnum("Advanced Operations", options)).toBe("advanced_operations");
    expect(matchEnum("advanced-operations", options)).toBe("advanced_operations");
    expect(matchEnum("ADVANCED OPERATIONS", options)).toBe("advanced_operations");
    expect(matchEnum("Level 1 Complex", options)).toBe("level_1_complex");
  });

  it("refuses anything it cannot place", () => {
    // Defaulting here would file an aircraft as airworthy when the sheet said
    // something else, which is the worst outcome this module can produce.
    expect(matchEnum("Advanced-ish", options)).toBeNull();
    expect(matchEnum("", options)).toBeNull();
  });
});

describe("parseNumber", () => {
  it("reads plain numbers", () => {
    expect(parseNumber("42")).toBe(42);
    expect(parseNumber("12.5")).toBe(12.5);
    expect(parseNumber("-3")).toBe(-3);
  });

  it("tolerates how a spreadsheet formats them", () => {
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("12.5 kg")).toBe(12.5);
    expect(parseNumber("  8  ")).toBe(8);
  });

  it("refuses what is not a number", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("n/a")).toBeNull();
    expect(parseNumber("about 12")).toBeNull();
    expect(parseNumber("1.2.3")).toBeNull();
  });
});

describe("parseBoolean", () => {
  it("reads the words people put in a yes/no column", () => {
    for (const yes of ["yes", "Y", "TRUE", "1", "active", "x"]) {
      expect(parseBoolean(yes)).toBe(true);
    }
    for (const no of ["no", "N", "FALSE", "0", "inactive"]) {
      expect(parseBoolean(no)).toBe(false);
    }
  });

  it("refuses anything else rather than guessing", () => {
    expect(parseBoolean("maybe")).toBeNull();
    expect(parseBoolean("2")).toBeNull();
  });
});

describe("detectDateFormat", () => {
  it("recognises ISO", () => {
    expect(detectDateFormat(["2026-08-27", "2025-01-02"])).toEqual({
      format: "iso",
      ambiguous: false,
    });
  });

  it("settles the whole column from one unambiguous value", () => {
    // 27 cannot be a month, so every other value in the column is day-first.
    expect(detectDateFormat(["01/02/2026", "27/03/2026"])).toEqual({
      format: "dmy",
      ambiguous: false,
    });
    expect(detectDateFormat(["01/02/2026", "03/27/2026"])).toEqual({
      format: "mdy",
      ambiguous: false,
    });
  });

  it("admits when a column could be read either way", () => {
    // This is the case that matters: guessing wrong moves a certificate expiry
    // by up to eleven months, so the caller has to be told.
    expect(detectDateFormat(["01/02/2026", "03/04/2026"])).toEqual({
      format: "dmy",
      ambiguous: true,
    });
  });

  it("does not claim a format from nothing", () => {
    expect(detectDateFormat([]).ambiguous).toBe(true);
    expect(detectDateFormat(["not a date"]).ambiguous).toBe(true);
  });

  it("is not confused by a column that mixes ISO with a local format", () => {
    expect(detectDateFormat(["2026-08-27", "27/03/2026"])).toEqual({
      format: "dmy",
      ambiguous: false,
    });
  });
});

describe("parseDate", () => {
  it("passes ISO through", () => {
    expect(parseDate("2026-08-27", "iso")).toBe("2026-08-27");
  });

  it("reads a leading four-digit year whatever the file's format", () => {
    // One ISO value in a day-first file is still a year, month, day.
    expect(parseDate("2026-08-27", "dmy")).toBe("2026-08-27");
    expect(parseDate("2026-08-27", "mdy")).toBe("2026-08-27");
  });

  it("applies the format it was given", () => {
    expect(parseDate("03/04/2026", "dmy")).toBe("2026-04-03");
    expect(parseDate("03/04/2026", "mdy")).toBe("2026-03-04");
  });

  it("accepts the separators spreadsheets use", () => {
    expect(parseDate("27-08-2026", "dmy")).toBe("2026-08-27");
    expect(parseDate("27.08.2026", "dmy")).toBe("2026-08-27");
  });

  it("expands a two-digit year the way every spreadsheet does", () => {
    expect(parseDate("27/08/26", "dmy")).toBe("2026-08-27");
    expect(parseDate("27/08/98", "dmy")).toBe("1998-08-27");
  });

  it("rejects a date that does not exist", () => {
    // Passes the range checks and is still not a day.
    expect(parseDate("31/02/2026", "dmy")).toBeNull();
    expect(parseDate("31/04/2026", "dmy")).toBeNull();
    expect(parseDate("13/13/2026", "dmy")).toBeNull();
  });

  it("accepts a real leap day and rejects a false one", () => {
    expect(parseDate("29/02/2028", "dmy")).toBe("2028-02-29");
    expect(parseDate("29/02/2027", "dmy")).toBeNull();
  });

  it("rejects what is not a date at all", () => {
    expect(parseDate("", "iso")).toBeNull();
    expect(parseDate("soon", "iso")).toBeNull();
    expect(parseDate("2026-08", "iso")).toBeNull();
  });
});

describe("matchColumns", () => {
  it("finds a field by its column name, its label, or an alias", () => {
    const matched = matchColumns(["drone_id", "Model", "Make"], uavImport);
    expect(matched.get("drone_id")).toBe(0);
    expect(matched.get("model")).toBe(1);
    expect(matched.get("manufacturer")).toBe(2);
  });

  it("ignores case, spacing and punctuation in a header", () => {
    const matched = matchColumns(["  Aircraft ID  ", "MODEL"], uavImport);
    expect(matched.get("drone_id")).toBe(0);
    expect(matched.get("model")).toBe(1);
  });

  it("leaves a field unmatched rather than guessing at a stray column", () => {
    const matched = matchColumns(["drone_id", "colour"], uavImport);
    expect(matched.has("model")).toBe(false);
  });
});

describe("parseImport", () => {
  const HEADER = "Aircraft ID,Model,Manufacturer,Status,Airframe hours";

  it("reads a clean file", () => {
    const result = parseImport(
      `${HEADER}\nUAV-001,Matrice 350 RTK,DJI,Airworthy,120.5\nUAV-002,Mavic 3E,DJI,Grounded,44`,
      uavImport,
    );

    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].values).toMatchObject({
      drone_id: "UAV-001",
      model: "Matrice 350 RTK",
      status: "airworthy",
      baseline_flight_hours: 120.5,
    });
    expect(importableRows(result.rows)).toHaveLength(2);
  });

  it("numbers rows the way the spreadsheet does", () => {
    // The person is looking at the file while reading the preview; row 2 has
    // to mean the same thing in both.
    const result = parseImport(`${HEADER}\nUAV-001,M350,DJI,Airworthy,10`, uavImport);
    expect(result.rows[0].line).toBe(2);
  });

  it("refuses a file missing a required column, before reading any of it", () => {
    const result = parseImport("Model,Manufacturer\nM350,DJI", uavImport);
    expect(result.rows).toHaveLength(0);
    expect(result.missingRequired).toEqual(["Aircraft ID"]);
    expect(result.error).toContain("Aircraft ID");
  });

  it("keeps a good row and marks a bad one, rather than failing the file", () => {
    const result = parseImport(
      `${HEADER}\nUAV-001,M350,DJI,Airworthy,10\nUAV-002,M350,DJI,Sortof,20`,
      uavImport,
    );
    expect(result.rows[0].errors).toHaveLength(0);
    expect(result.rows[1].errors[0].message).toContain("Sortof");
    expect(importableRows(result.rows).map((r) => r.values.drone_id)).toEqual(["UAV-001"]);
  });

  it("flags a required value that is blank", () => {
    const result = parseImport(`${HEADER}\n,M350,DJI,Airworthy,10`, uavImport);
    expect(result.rows[0].errors[0].message).toContain("required");
  });

  it("catches a transposed digit through the bounds", () => {
    // 50,000 hours on a small UAV is a typo, and it would skew every derived
    // figure the portal computes from airframe hours.
    const result = parseImport(`${HEADER}\nUAV-001,M350,DJI,Airworthy,50000`, uavImport);
    expect(result.rows[0].errors[0].message).toContain("cannot be above");
  });

  it("reports a repeated aircraft rather than importing it twice", () => {
    const result = parseImport(
      `${HEADER}\nUAV-001,M350,DJI,Airworthy,10\nUAV-001,M350,DJI,Airworthy,20`,
      uavImport,
    );
    expect(result.rows[1].duplicateOfLine).toBe(2);
    expect(importableRows(result.rows)).toHaveLength(1);
  });

  it("names the columns it did not recognise", () => {
    const result = parseImport(`${HEADER},Colour\nUAV-001,M350,DJI,Airworthy,10,red`, uavImport);
    expect(result.unmatchedHeaders).toEqual(["Colour"]);
    // Unrecognised is not fatal — the row still imports.
    expect(importableRows(result.rows)).toHaveLength(1);
  });

  it("handles quoted fields containing commas", () => {
    const result = parseImport(
      `Aircraft ID,Model,Notes\nUAV-001,"Matrice 350, RTK","Bought used, needs check"`,
      uavImport,
    );
    expect(result.rows[0].values.model).toBe("Matrice 350, RTK");
    expect(result.rows[0].values.notes).toBe("Bought used, needs check");
  });

  it("strips the byte order mark Excel writes", () => {
    // Without this the first header reads as "﻿Aircraft ID" and the
    // required column appears to be missing.
    const result = parseImport(`﻿${HEADER}\nUAV-001,M350,DJI,Airworthy,10`, uavImport);
    expect(result.error).toBeNull();
    expect(result.rows[0].values.drone_id).toBe("UAV-001");
  });

  it("ignores blank lines at the end of a file", () => {
    const result = parseImport(`${HEADER}\nUAV-001,M350,DJI,Airworthy,10\n\n\n`, uavImport);
    expect(result.rows).toHaveLength(1);
  });

  it("says so when there is nothing to import", () => {
    expect(parseImport("", uavImport).error).toContain("empty");
    expect(parseImport(HEADER, uavImport).error).toContain("no data");
  });

  it("refuses a file too large to be a fleet", () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `UAV-${i},M350,,,`);
    const result = parseImport(`${HEADER}\n${rows.join("\n")}`, uavImport);
    expect(result.error).toContain("at most");
  });
});

describe("parseImport dates", () => {
  const HEADER = "Full name,Certificate expires";

  it("reads a day-first column once one value settles it", () => {
    const result = parseImport(
      `${HEADER}\nA Pilot,01/02/2026\nB Pilot,27/03/2026`,
      pilotImport,
    );
    expect(result.dateFormat).toBe("dmy");
    expect(result.dateAmbiguous).toBe(false);
    expect(result.rows[0].values.certificate_expires).toBe("2026-02-01");
  });

  it("flags an ambiguous column instead of quietly choosing", () => {
    const result = parseImport(`${HEADER}\nA Pilot,03/04/2026`, pilotImport);
    expect(result.dateAmbiguous).toBe(true);
  });

  it("honours a format the person picked over what it guessed", () => {
    const result = parseImport(`${HEADER}\nA Pilot,03/04/2026`, pilotImport, "mdy");
    expect(result.dateFormat).toBe("mdy");
    expect(result.dateAmbiguous).toBe(false);
    expect(result.rows[0].values.certificate_expires).toBe("2026-03-04");
  });

  it("does not call an all-ISO file ambiguous", () => {
    const result = parseImport(`${HEADER}\nA Pilot,2026-04-03`, pilotImport);
    expect(result.dateAmbiguous).toBe(false);
    expect(result.rows[0].values.certificate_expires).toBe("2026-04-03");
  });

  it("is not ambiguous when the file has no dates at all", () => {
    const result = parseImport("Full name\nA Pilot", pilotImport);
    expect(result.dateAmbiguous).toBe(false);
  });
});

describe("summariseImport", () => {
  it("counts what will land and what will not", () => {
    const result = parseImport(
      [
        "Aircraft ID,Model,Status",
        "UAV-001,M350,Airworthy",
        "UAV-002,M350,Nonsense",
        "UAV-001,M350,Airworthy",
      ].join("\n"),
      uavImport,
    );
    expect(summariseImport(result.rows)).toEqual({
      total: 3,
      ready: 1,
      withErrors: 1,
      duplicates: 1,
    });
  });
});

describe("templateCsv", () => {
  it("gives a header row and a hint row", () => {
    const lines = templateCsv(uavImport).split("\r\n");
    expect(lines[0]).toContain("Aircraft ID");
    expect(lines[1]).toContain("required");
  });

  it("lists an enum's choices the way the portal words them", () => {
    // The template is what someone fills in, so it offers the labels they will
    // see on screen rather than the underscored values stored behind them.
    expect(templateCsv(uavImport)).toContain(
      "Airworthy | In maintenance | Grounded | Retired",
    );
  });

  it("starts with a byte order mark, so Excel reads accented names", () => {
    expect(templateCsv(pilotImport).startsWith("﻿")).toBe(true);
  });

  it("quotes a hint containing a comma, so the template is valid CSV", () => {
    // The enum hints are pipe-separated for exactly this reason, but any hint
    // with a comma must still survive a round trip.
    for (const schema of Object.values(importSchemas)) {
      const [, hintRow] = templateCsv(schema).split("\r\n");
      const cells = hintRow.split(",").length;
      const headerCells = templateCsv(schema).split("\r\n")[0].split(",").length;
      expect(cells).toBe(headerCells);
    }
  });
});

describe("every schema", () => {
  it("has a natural key among its own fields", () => {
    for (const [name, schema] of Object.entries(importSchemas)) {
      const columns = schema.fields.map((f) => f.column);
      expect(columns, name).toContain(schema.naturalKey);
    }
  });

  it("gives every enum field its options", () => {
    for (const [name, schema] of Object.entries(importSchemas)) {
      for (const field of schema.fields) {
        if (field.type === "enum") {
          expect(field.options?.length, `${name}.${field.column}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("bounds every number, so a transposed digit cannot land", () => {
    for (const [name, schema] of Object.entries(importSchemas)) {
      for (const field of schema.fields) {
        if (field.type === "number" || field.type === "integer") {
          expect(field.min, `${name}.${field.column}`).toBeDefined();
          expect(field.max, `${name}.${field.column}`).toBeDefined();
        }
      }
    }
  });

  it("has no duplicate column or header spelling within a schema", () => {
    for (const [name, schema] of Object.entries(importSchemas)) {
      const columns = schema.fields.map((f) => f.column);
      expect(new Set(columns).size, name).toBe(columns.length);

      // Two *different* fields answering to the same header would make column
      // matching arbitrary. Within one field a collision is expected and fine:
      // "full_name" and "Full name" normalise to the same thing on purpose.
      const claimed = new Map<string, string>();
      for (const field of schema.fields) {
        const spellings = new Set(
          [field.column, field.label, ...(field.aliases ?? [])].map((s) =>
            s.toLowerCase().replace(/[^a-z0-9]/g, ""),
          ),
        );
        for (const spelling of spellings) {
          const owner = claimed.get(spelling);
          expect(
            owner,
            `${name}: "${spelling}" is claimed by both ${owner} and ${field.column}`,
          ).toBeUndefined();
          claimed.set(spelling, field.column);
        }
      }
    }
  });
});

describe("enum labels the portal itself shows", () => {
  it("accepts the label as well as the stored value", () => {
    // The fleet table shows "In maintenance". Someone reading the portal and
    // writing a spreadsheet from it is not making a mistake.
    const result = parseImport(
      "Aircraft ID,Model,Status\nUAV-001,M350,IN MAINTENANCE",
      uavImport,
    );
    expect(result.rows[0].errors).toHaveLength(0);
    expect(result.rows[0].values.status).toBe("maintenance");
  });

  it("accepts a certificate type written the way the portal writes it", () => {
    const result = parseImport(
      "Full name,Certificate type\nA Pilot,Advanced Operations",
      pilotImport,
    );
    expect(result.rows[0].values.certificate_type).toBe("advanced_operations");
  });

  it("still refuses something that is neither", () => {
    const result = parseImport("Aircraft ID,Model,Status\nUAV-001,M350,Sortof", uavImport);
    expect(result.rows[0].errors).toHaveLength(1);
  });

  it("names the accepted values by their labels, not their stored form", () => {
    // "not one of: airworthy, maintenance" is less use to someone staring at a
    // spreadsheet than the words they would actually see on screen.
    const result = parseImport("Aircraft ID,Model,Status\nUAV-001,M350,Sortof", uavImport);
    expect(result.rows[0].errors[0].message).toContain("In maintenance");
  });

  it("labels every option it labels at all, so the message is not half-translated", () => {
    for (const [name, schema] of Object.entries(importSchemas)) {
      for (const field of schema.fields) {
        if (field.type !== "enum" || !field.optionLabels) continue;
        for (const option of field.options ?? []) {
          expect(field.optionLabels[option], `${name}.${field.column}.${option}`).toBeTruthy();
        }
      }
    }
  });
});
