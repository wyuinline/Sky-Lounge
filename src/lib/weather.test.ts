import { describe, it, expect } from "vitest";
import {
  isValidStationId,
  parseObservation,
  parseObservations,
  summarise,
} from "@/lib/weather";

/** A real response from the service, for CYEG. */
const REAL = {
  icaoId: "CYEG",
  receiptTime: "2026-08-26T23:08:16.480Z",
  obsTime: 1787785200,
  reportTime: "2026-08-26T23:00:00.000Z",
  temp: 28,
  dewp: 15,
  wdir: 170,
  wspd: 6,
  visib: 20,
  altim: 1014.6,
  metarType: "METAR",
  rawOb: "METAR CYEG 262300Z 17006KT 20SM FEW250 28/15 A2996 RMK CI2 SLP145",
  lat: 53.308,
  lon: -113.592,
  name: "Edmonton Intl Arpt, AB, CA",
  fltCat: "VFR",
};

describe("isValidStationId", () => {
  it("accepts a four-letter identifier in any case", () => {
    expect(isValidStationId("CYEG")).toBe(true);
    expect(isValidStationId("cyeg")).toBe(true);
    expect(isValidStationId(" CYEG ")).toBe(true);
  });

  it("rejects anything that is not four letters", () => {
    expect(isValidStationId("CYE")).toBe(false);
    expect(isValidStationId("CYEGX")).toBe(false);
    expect(isValidStationId("CY3G")).toBe(false);
    expect(isValidStationId("")).toBe(false);
  });
});

describe("parseObservation", () => {
  it("reads a real service record", () => {
    const o = parseObservation(REAL);
    expect(o).not.toBeNull();
    expect(o?.station).toBe("CYEG");
    expect(o?.windDirectionDeg).toBe(170);
    expect(o?.windSpeedKt).toBe(6);
    expect(o?.temperatureC).toBe(28);
    expect(o?.visibilitySm).toBe(20);
    expect(o?.flightCategory).toBe("VFR");
    expect(o?.observedAt).toBe("2026-08-26T23:00:00.000Z");
    expect(o?.stationName).toContain("Edmonton");
  });

  it("refuses a record with no station", () => {
    // An observation that cannot say where it came from is not evidence.
    expect(parseObservation({ ...REAL, icaoId: undefined })).toBeNull();
    expect(parseObservation(null)).toBeNull();
    expect(parseObservation("CYEG")).toBeNull();
  });

  it("records variable wind as no direction rather than north", () => {
    const o = parseObservation({ ...REAL, wdir: "VRB", wspd: 4 });
    expect(o?.windDirectionDeg).toBeNull();
    expect(o?.windSpeedKt).toBe(4);
  });

  it("reads visibility reported as a string with a plus", () => {
    expect(parseObservation({ ...REAL, visib: "10+" })?.visibilitySm).toBe(10);
    expect(parseObservation({ ...REAL, visib: "6" })?.visibilitySm).toBe(6);
  });

  it("falls back to the unix observation time when there is no report time", () => {
    const o = parseObservation({ ...REAL, reportTime: undefined });
    expect(o?.observedAt).toBe(new Date(REAL.obsTime * 1000).toISOString());
  });

  it("drops a flight category it does not recognise", () => {
    expect(parseObservation({ ...REAL, fltCat: "SOMETHING" })?.flightCategory).toBeNull();
  });

  it("leaves missing fields null rather than guessing zero", () => {
    const o = parseObservation({ icaoId: "CYYC", rawOb: "METAR CYYC ..." });
    expect(o?.windSpeedKt).toBeNull();
    expect(o?.temperatureC).toBeNull();
    expect(o?.visibilitySm).toBeNull();
  });

  it("keeps a temperature of zero, which is a real reading", () => {
    expect(parseObservation({ ...REAL, temp: 0 })?.temperatureC).toBe(0);
  });
});

describe("parseObservations", () => {
  it("takes the first usable record", () => {
    expect(parseObservations([REAL])?.station).toBe("CYEG");
  });

  it("skips unusable records rather than failing outright", () => {
    expect(parseObservations([{ junk: true }, REAL])?.station).toBe("CYEG");
  });

  it("returns null for an empty or wrong-shaped response", () => {
    expect(parseObservations([])).toBeNull();
    expect(parseObservations({})).toBeNull();
    expect(parseObservations(null)).toBeNull();
  });
});

describe("summarise", () => {
  it("writes a line a person would actually say", () => {
    expect(summarise(parseObservation(REAL)!)).toBe("170° at 6 kt, 28°C, 20 SM, VFR");
  });

  it("says calm rather than 0 kt from an arbitrary direction", () => {
    const o = parseObservation({ ...REAL, wspd: 0, wdir: 0 })!;
    expect(summarise(o)).toContain("calm");
    expect(summarise(o)).not.toContain("0 kt");
  });

  it("says variable when there is speed but no direction", () => {
    expect(summarise(parseObservation({ ...REAL, wdir: "VRB", wspd: 7 })!)).toContain(
      "variable 7 kt",
    );
  });

  it("does not produce an empty string when nothing was reported", () => {
    expect(summarise(parseObservation({ icaoId: "CYYC" })!)).toBe("Observation recorded");
  });
});
