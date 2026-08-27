import { describe, it, expect } from "vitest";
import {
  parseTelemetryCsv,
  normaliseHeader,
  splitCsvLine,
  haversine,
  downsample,
  summarise,
  readStoredTrack,
  findCellColumns,
  type TelemetrySample,
} from "@/lib/telemetry";

/** A DJI-style export, as their log viewers produce it. */
const DJI_CSV = [
  "time(millisecond),latitude,longitude,height(m),speed(m/s),battery(%),voltage(V),satellites",
  "0,53.546100,-113.493800,0.0,0.0,100,25.2,14",
  "1000,53.546150,-113.493800,12.5,4.2,99,25.0,14",
  "2000,53.546200,-113.493800,45.0,8.1,97,24.7,15",
  "3000,53.546250,-113.493800,90.0,6.0,94,24.4,15",
].join("\n");

/** An ArduPilot-style export: different names, same meaning. */
const ARDU_CSV = [
  "timestamp,Lat,Lng,Alt,GroundSpeed,BatteryLevel,NumSats",
  "0,53.5461,-113.4938,0,0,100,12",
  "5,53.5465,-113.4938,30,5,98,12",
].join("\n");

describe("normaliseHeader", () => {
  it("strips units, punctuation and case", () => {
    expect(normaliseHeader("Height(m)")).toBe("heightm");
    expect(normaliseHeader("GPS(Lat)")).toBe("gpslat");
    expect(normaliseHeader("  Battery %  ")).toBe("battery");
    expect(normaliseHeader("OSD.latitude")).toBe("osdlatitude");
  });

  it("drops bracketed unit suffixes", () => {
    expect(normaliseHeader("altitude [m]")).toBe("altitude");
  });
});

describe("splitCsvLine", () => {
  it("splits plain fields", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps a quoted comma inside its field", () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it("unescapes a doubled quote", () => {
    expect(splitCsvLine('a,"say ""hi""",c')).toEqual(["a", 'say "hi"', "c"]);
  });

  it("preserves empty fields rather than collapsing them", () => {
    expect(splitCsvLine("a,,c")).toEqual(["a", "", "c"]);
  });
});

describe("haversine", () => {
  it("is zero for the same point", () => {
    expect(haversine(53.5461, -113.4938, 53.5461, -113.4938)).toBe(0);
  });

  it("measures a known short distance", () => {
    // 0.001 degrees of latitude is about 111 m anywhere on Earth.
    const d = haversine(53.5461, -113.4938, 53.5471, -113.4938);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });

  it("is symmetric", () => {
    const a = haversine(53.5, -113.5, 53.6, -113.4);
    const b = haversine(53.6, -113.4, 53.5, -113.5);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("downsample", () => {
  it("leaves a short track alone", () => {
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it("reduces to the limit", () => {
    expect(downsample(Array.from({ length: 1000 }, (_, i) => i), 50)).toHaveLength(50);
  });

  it("always keeps the first and last point", () => {
    // The track has to end where the flight did.
    const out = downsample(Array.from({ length: 1000 }, (_, i) => i), 10);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(999);
  });
});

describe("parseTelemetryCsv", () => {
  it("reads a DJI-style export", () => {
    const result = parseTelemetryCsv(DJI_CSV);
    expect(result.error).toBeNull();
    expect(result.samples).toHaveLength(4);
    expect(result.summary?.maxAltitude).toBe(90);
    expect(result.summary?.maxSpeed).toBe(8.1);
    expect(result.summary?.batteryStart).toBe(100);
    expect(result.summary?.batteryEnd).toBe(94);
    expect(result.summary?.minVoltage).toBe(24.4);
    expect(result.summary?.minSatellites).toBe(14);
  });

  it("reads an ArduPilot-style export with different column names", () => {
    // The whole point of matching on names rather than position: a portal that
    // only accepts one vendor's spelling accepts one vendor.
    const result = parseTelemetryCsv(ARDU_CSV);
    expect(result.error).toBeNull();
    expect(result.summary?.maxAltitude).toBe(30);
    expect(result.summary?.hasPositions).toBe(true);
  });

  it("converts milliseconds to seconds and rebases on the first row", () => {
    const result = parseTelemetryCsv(DJI_CSV);
    expect(result.samples?.[0].t).toBe(0);
    expect(result.samples?.[3].t).toBe(3);
    expect(result.summary?.durationSeconds).toBe(3);
  });

  it("reads ISO timestamps as well as offsets", () => {
    const csv = [
      "datetime(utc),latitude,longitude,height(m)",
      "2026-08-26T14:00:00Z,53.5461,-113.4938,0",
      "2026-08-26T14:00:30Z,53.5461,-113.4938,50",
    ].join("\n");
    const result = parseTelemetryCsv(csv);
    expect(result.error).toBeNull();
    expect(result.summary?.durationSeconds).toBe(30);
  });

  it("discards the null island rather than plotting the Atlantic", () => {
    // DJI logs routinely start with 0,0 rows before the first fix.
    const csv = [
      "time,latitude,longitude,height(m)",
      "0,0,0,0",
      "1,53.5461,-113.4938,10",
      "2,53.5471,-113.4938,20",
    ].join("\n");
    const result = parseTelemetryCsv(csv);
    expect(result.samples?.[0].lat).toBeNull();
    expect(result.samples?.[0].lon).toBeNull();
    // Distance is measured from the first real fix, not from Africa.
    expect(result.summary?.maxDistance).toBeLessThan(200);
  });

  it("refuses a file with no data rows", () => {
    expect(parseTelemetryCsv("header,only").error).toContain("no data rows");
    expect(parseTelemetryCsv("").error).toContain("no data rows");
  });

  it("refuses a file with nothing it can use", () => {
    // Better to say so than to import a file that produces an empty plot.
    const result = parseTelemetryCsv("foo,bar\n1,2");
    expect(result.error).toContain("No position or altitude");
    expect(result.unmatchedHeaders).toEqual(["foo", "bar"]);
  });

  it("accepts altitude alone, without position", () => {
    const result = parseTelemetryCsv("time,height(m)\n0,0\n1,50");
    expect(result.error).toBeNull();
    expect(result.summary?.maxAltitude).toBe(50);
    expect(result.summary?.hasPositions).toBe(false);
  });

  it("reports columns it did not recognise, rather than silently dropping them", () => {
    const result = parseTelemetryCsv(
      "time,latitude,longitude,height(m),gimbalPitch\n0,53.5,-113.5,0,-90",
    );
    expect(result.unmatchedHeaders).toContain("gimbalpitch");
  });

  it("treats blanks and dashes as missing rather than zero", () => {
    // A blank battery reading is not a flat battery.
    const result = parseTelemetryCsv(
      "time,latitude,longitude,height(m),battery(%)\n0,53.5,-113.5,0,\n1,53.5,-113.5,10,-",
    );
    expect(result.samples?.[0].batteryPercent).toBeNull();
    expect(result.samples?.[1].batteryPercent).toBeNull();
    expect(result.summary?.batteryStart).toBeNull();
  });

  it("computes track length along the path, not end to end", () => {
    // Out and back: the straight-line distance is nearly nothing, the track is not.
    const csv = [
      "time,latitude,longitude,height(m)",
      "0,53.5461,-113.4938,0",
      "1,53.5471,-113.4938,10",
      "2,53.5461,-113.4938,0",
    ].join("\n");
    const result = parseTelemetryCsv(csv);
    expect(result.summary?.maxDistance).toBeLessThan(120);
    expect(result.summary?.trackLength).toBeGreaterThan(200);
  });

  it("falls back to row order when there is no usable time column", () => {
    const result = parseTelemetryCsv("latitude,longitude,height(m)\n53.5,-113.5,0\n53.5,-113.5,10");
    expect(result.samples?.[0].t).toBe(0);
    expect(result.samples?.[1].t).toBe(1);
  });
});

describe("summarise", () => {
  it("copes with an empty track without throwing", () => {
    const summary = summarise([]);
    expect(summary.sampleCount).toBe(0);
    expect(summary.maxAltitude).toBeNull();
    expect(summary.hasPositions).toBe(false);
  });

  it("needs two fixes before claiming a track", () => {
    const one: TelemetrySample[] = [
      { t: 0, lat: 53.5, lon: -113.5, altitude: 0, speed: null, batteryPercent: null, voltage: null, satellites: null },
    ];
    expect(summarise(one).hasPositions).toBe(false);
  });
});

describe("readStoredTrack", () => {
  const good = [
    { t: 0, lat: 53.5461, lon: -113.4938, alt: 0 },
    { t: 1, lat: 53.5471, lon: -113.4938, alt: 50 },
  ];

  it("reads a well-formed stored track", () => {
    expect(readStoredTrack(good)).toHaveLength(2);
  });

  it("refuses anything that is not an array", () => {
    expect(readStoredTrack(null)).toBeNull();
    expect(readStoredTrack("track")).toBeNull();
    expect(readStoredTrack({ lat: 1, lon: 2 })).toBeNull();
  });

  it("drops points with no usable position rather than trusting them", () => {
    const mixed = [...good, { t: 2, lat: "north", lon: -113.5 }, { t: 3 }];
    expect(readStoredTrack(mixed)).toHaveLength(2);
  });

  it("drops impossible coordinates", () => {
    // A latitude of 953 is corruption, not a position.
    expect(readStoredTrack([...good, { t: 2, lat: 953, lon: -113.5 }])).toHaveLength(2);
  });

  it("treats a single point as no track", () => {
    expect(readStoredTrack([good[0]])).toBeNull();
    expect(readStoredTrack([])).toBeNull();
  });

  it("defaults a missing altitude to null, not zero", () => {
    // Zero altitude means on the ground, which is a claim the data did not make.
    const out = readStoredTrack([
      { t: 0, lat: 53.5, lon: -113.5 },
      { t: 1, lat: 53.6, lon: -113.5 },
    ]);
    expect(out?.[0].alt).toBeNull();
  });
});

describe("cell voltages", () => {
  const CELLS_CSV = [
    "time(millisecond),latitude,longitude,height(m),battery.cellVoltage1,battery.cellVoltage2,battery.cellVoltage3,battery.cellVoltage4",
    "0,53.5461,-113.4938,0,4.18,4.18,4.17,4.18",
    "1000,53.5462,-113.4938,20,4.05,4.04,3.86,4.05",
    "2000,53.5463,-113.4938,40,3.92,3.91,3.70,3.92",
  ].join("\n");

  it("finds cell columns whatever they are called", () => {
    expect(findCellColumns(["cellvoltage1", "cellvoltage2"])).toEqual([0, 1]);
    expect(findCellColumns(["volt1", "volt2", "volt3"])).toEqual([0, 1, 2]);
    expect(findCellColumns(["cell1", "cell2"])).toEqual([0, 1]);
    expect(findCellColumns(["latitude", "cellvoltage2", "cellvoltage1"])).toEqual([2, 1]);
  });

  it("orders columns by cell number, not by position in the file", () => {
    // Ten before two is a string-sort trap that would mislabel every cell.
    const headers = ["cellvoltage10", "cellvoltage2", "cellvoltage1"];
    expect(findCellColumns(headers)).toEqual([2, 1, 0]);
  });

  it("finds nothing in a file without per-cell columns", () => {
    expect(findCellColumns(["latitude", "voltage", "battery"])).toEqual([]);
  });

  it("reads the widest spread and when it happened", () => {
    const result = parseTelemetryCsv(CELLS_CSV);
    expect(result.error).toBeNull();
    expect(result.summary?.cellCount).toBe(4);
    // Cell 3 is the weak one: 4.05 - 3.86 = 0.19 at t=1, 3.92 - 3.70 = 0.22 at t=2.
    expect(result.summary?.maxCellSpread).toBeCloseTo(0.22, 3);
    expect(result.summary?.maxCellSpreadAt).toBe(2);
    expect(result.summary?.minCellVoltage).toBeCloseTo(3.7, 3);
  });

  it("does not treat cell columns as unrecognised", () => {
    const result = parseTelemetryCsv(CELLS_CSV);
    expect(result.unmatchedHeaders).toEqual([]);
  });

  it("reports no cell data for a file that has none", () => {
    const result = parseTelemetryCsv(DJI_CSV);
    expect(result.summary?.cellCount).toBeNull();
    expect(result.summary?.maxCellSpread).toBeNull();
  });

  it("skips readings taken before the pack woke up", () => {
    // Packs report zeroes at power-on; a spurious 4-volt spread on every
    // flight would drown the real signal.
    const csv = [
      "time,latitude,longitude,height(m),cell1,cell2",
      "0,53.5,-113.5,0,0,0",
      "1,53.5,-113.5,10,4.10,4.05",
    ].join("\n");
    const result = parseTelemetryCsv(csv);
    expect(result.summary?.maxCellSpread).toBeCloseTo(0.05, 3);
    expect(result.summary?.minCellVoltage).toBeCloseTo(4.05, 3);
  });

  it("ignores a single-cell column, which cannot have a spread", () => {
    const result = parseTelemetryCsv("time,latitude,longitude,height(m),cell1\n0,53.5,-113.5,0,4.1");
    expect(result.summary?.maxCellSpread).toBeNull();
  });

  it("copes with a pack that reports no usable readings at all", () => {
    const csv = [
      "time,latitude,longitude,height(m),cell1,cell2",
      "0,53.5,-113.5,0,0,0",
      "1,53.5,-113.5,10,0,0",
    ].join("\n");
    const result = parseTelemetryCsv(csv);
    expect(result.summary?.maxCellSpread).toBeNull();
    expect(result.summary?.cellCount).toBe(2);
  });
});
