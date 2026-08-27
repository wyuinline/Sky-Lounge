/**
 * Flight telemetry import.
 *
 * The competitive gap analysis called telemetry the headline difference
 * between this portal and Airdata, and the honest scoping answer turned out to
 * be narrower than "ingest DJI logs".
 *
 * What the spike found: DJI flight records from version 13 onward are AES
 * encrypted and need a keychain fetched from DJI's own API with a registered
 * developer key. The mature parser for them is a Rust crate, which means a
 * WASM build or a sidecar service to use from here. The enterprise route —
 * DJI Cloud API over MQTT — works for the Matrice 350 but requires a
 * FlightHub 2 subscription.
 *
 * Both are real, and neither is worth carrying for two airframes. What every
 * one of those tools can already do is export CSV, and so can ArduPilot and
 * PX4. So this parses CSV, from whichever source produced it, by recognising
 * the column names rather than requiring a particular layout.
 *
 * Pure and tested: a telemetry parser that silently mis-reads altitude is far
 * worse than one that refuses the file.
 */

export type TelemetrySample = {
  /** Seconds from the start of the recording. */
  t: number;
  lat: number | null;
  lon: number | null;
  /** Metres above the take-off point. */
  altitude: number | null;
  speed: number | null;
  batteryPercent: number | null;
  voltage: number | null;
  satellites: number | null;
};

export type TelemetrySummary = {
  sampleCount: number;
  durationSeconds: number | null;
  maxAltitude: number | null;
  maxSpeed: number | null;
  /** Greatest straight-line distance from the first fix, in metres. */
  maxDistance: number | null;
  /** Total ground track length, in metres. */
  trackLength: number | null;
  batteryStart: number | null;
  batteryEnd: number | null;
  minVoltage: number | null;
  minSatellites: number | null;
  hasPositions: boolean;
};

export type ParseResult =
  | { error: string; samples: null; summary: null; unmatchedHeaders: string[] }
  | { error: null; samples: TelemetrySample[]; summary: TelemetrySummary; unmatchedHeaders: string[] };

/**
 * Column aliases, lowercased with punctuation stripped.
 *
 * Deliberately generous: DJI, Airdata, ArduPilot and PX4 all name these
 * differently, and a portal that only accepts one vendor's spelling is a
 * portal that only accepts one vendor.
 */
const ALIASES: Record<keyof Omit<TelemetrySample, "t">, string[]> = {
  lat: ["latitude", "lat", "gpslat", "osdlatitude", "gpslatitude"],
  lon: ["longitude", "lon", "lng", "long", "gpslon", "osdlongitude", "gpslongitude"],
  altitude: [
    "heightm",
    "height",
    "altitudem",
    "altitude",
    "alt",
    "relativeheight",
    "osdheight",
    "altitudeabovesealevel",
  ],
  speed: ["speedms", "speed", "hspeed", "horizontalspeed", "osdhspeed", "groundspeed"],
  batteryPercent: [
    "battery",
    "batterypercent",
    "batterylevel",
    "batterychargelevel",
    "batterypercentage",
    "remainpowerpercent",
  ],
  voltage: ["voltagev", "voltage", "batteryvoltage", "volt"],
  satellites: ["satellites", "gpsnum", "numsats", "satcount", "gpssatellites"],
};

const TIME_ALIASES = [
  "timemillisecond",
  "timems",
  "milliseconds",
  "offsettime",
  "flighttime",
  "time",
  "timestamp",
  "datetimeutc",
  "datetimelocal",
  "datetime",
  "date",
];

/** Strips units, punctuation and case so headers can be compared. */
export function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Splits one CSV line, honouring quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const text = raw.trim();
  if (text === "" || text === "-" || text.toLowerCase() === "null") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * How many of the time column's units make a second.
 *
 * Decided from the header, not from the values. An earlier version guessed
 * from magnitude — anything over a day must be milliseconds — which is wrong
 * for exactly the most common case: DJI writes time(millisecond) starting at
 * zero, so a four-second flight read as four thousand seconds. The column name
 * knows the unit; the numbers do not.
 *
 * The magnitude check survives only for genuinely ambiguous names, where a
 * value that large can only be a unix epoch in milliseconds.
 */
function timeDivisor(header: string, firstValue: number | null): number {
  if (/millisecond|(^|[^a-z])ms($|[^a-z])/.test(header)) return 1000;
  if (firstValue !== null && Math.abs(firstValue) > 1e11) return 1000;
  return 1;
}

/**
 * A time value in the column's own units, or null.
 *
 * Rebasing against the first row happens in the caller, so absolute scale is
 * all that matters here: an ISO timestamp becomes seconds, a numeric column
 * stays in its own units until the divisor is applied.
 */
function readTime(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const text = raw.trim();
  if (text === "") return null;

  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric;

  const parsed = new Date(text.replace(" ", "T"));
  // Already seconds, so it must not be divided again — flagged by returning a
  // value the caller knows is pre-scaled.
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime() / 1000;

  return null;
}

/** Whether a raw cell is a date rather than a bare number. */
function isDateLike(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const text = raw.trim();
  return text !== "" && !Number.isFinite(Number(text));
}

/** Great-circle distance in metres. */
export function haversine(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Reduces a track to at most `limit` points, keeping the shape.
 *
 * Every nth point rather than a douglas-peucker simplification: it is enough
 * for a plot at this size, and it cannot accidentally drop the one excursion
 * that made the flight interesting the way an error-threshold filter can.
 * The last sample is always kept so the track ends where the flight did.
 */
export function downsample<T>(samples: T[], limit: number): T[] {
  if (samples.length <= limit || limit < 2) return samples;
  const step = (samples.length - 1) / (limit - 1);
  const out: T[] = [];
  for (let i = 0; i < limit - 1; i++) out.push(samples[Math.round(i * step)]);
  out.push(samples[samples.length - 1]);
  return out;
}

export function summarise(samples: TelemetrySample[]): TelemetrySummary {
  const positioned = samples.filter(
    (s): s is TelemetrySample & { lat: number; lon: number } => s.lat !== null && s.lon !== null,
  );

  const values = (pick: (s: TelemetrySample) => number | null) =>
    samples.map(pick).filter((v): v is number => v !== null);

  const altitudes = values((s) => s.altitude);
  const speeds = values((s) => s.speed);
  const batteries = values((s) => s.batteryPercent);
  const voltages = values((s) => s.voltage);
  const sats = values((s) => s.satellites);

  let maxDistance: number | null = null;
  let trackLength: number | null = null;

  if (positioned.length > 0) {
    const origin = positioned[0];
    maxDistance = 0;
    trackLength = 0;
    for (let i = 0; i < positioned.length; i++) {
      const p = positioned[i];
      maxDistance = Math.max(maxDistance, haversine(origin.lat, origin.lon, p.lat, p.lon));
      if (i > 0) {
        const q = positioned[i - 1];
        trackLength += haversine(q.lat, q.lon, p.lat, p.lon);
      }
    }
  }

  const times = samples.map((s) => s.t).filter((t) => Number.isFinite(t));

  return {
    sampleCount: samples.length,
    durationSeconds: times.length > 1 ? Math.max(...times) - Math.min(...times) : null,
    maxAltitude: altitudes.length > 0 ? Math.max(...altitudes) : null,
    maxSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
    maxDistance,
    trackLength,
    batteryStart: batteries.length > 0 ? batteries[0] : null,
    batteryEnd: batteries.length > 0 ? batteries[batteries.length - 1] : null,
    minVoltage: voltages.length > 0 ? Math.min(...voltages) : null,
    minSatellites: sats.length > 0 ? Math.min(...sats) : null,
    hasPositions: positioned.length > 1,
  };
}

/** Largest file worth parsing in a request. */
export const MAX_TELEMETRY_ROWS = 200_000;

export function parseTelemetryCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    return {
      error: "That file has no data rows. Export the flight log as CSV and try again.",
      samples: null,
      summary: null,
      unmatchedHeaders: [],
    };
  }
  if (lines.length - 1 > MAX_TELEMETRY_ROWS) {
    return {
      error: `That file has more than ${MAX_TELEMETRY_ROWS.toLocaleString()} rows. Export at a lower sample rate.`,
      samples: null,
      summary: null,
      unmatchedHeaders: [],
    };
  }

  const headers = splitCsvLine(lines[0]).map(normaliseHeader);

  const indexOfAny = (candidates: string[]): number => {
    for (const candidate of candidates) {
      const i = headers.indexOf(candidate);
      if (i !== -1) return i;
    }
    // Fall back to a prefix match: "batterychargelevel1" and similar are
    // common, and refusing them over a suffix would be pedantic.
    for (const candidate of candidates) {
      const i = headers.findIndex((h) => h.startsWith(candidate));
      if (i !== -1) return i;
    }
    return -1;
  };

  const columns = {
    t: indexOfAny(TIME_ALIASES),
    lat: indexOfAny(ALIASES.lat),
    lon: indexOfAny(ALIASES.lon),
    altitude: indexOfAny(ALIASES.altitude),
    speed: indexOfAny(ALIASES.speed),
    batteryPercent: indexOfAny(ALIASES.batteryPercent),
    voltage: indexOfAny(ALIASES.voltage),
    satellites: indexOfAny(ALIASES.satellites),
  };

  // Position and altitude are what make a track; without either there is
  // nothing here the portal can use, and saying so beats importing a file that
  // produces an empty plot.
  if (columns.lat === -1 && columns.altitude === -1) {
    return {
      error:
        "No position or altitude columns recognised. The file needs at least latitude and longitude, or a height column.",
      samples: null,
      summary: null,
      unmatchedHeaders: headers,
    };
  }

  const matched = new Set(Object.values(columns).filter((i) => i !== -1));
  const unmatchedHeaders = headers.filter((_, i) => !matched.has(i));

  const rows: TelemetrySample[] = [];
  let firstTime: number | null = null;
  let divisor = 1;
  let divisorSettled = false;

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const cell = columns.t === -1 ? undefined : cells[columns.t];
    const raw = columns.t === -1 ? null : readTime(cell);

    // Settle the unit once, from the header and the first usable value. A date
    // column is already seconds and must not be divided again.
    if (!divisorSettled && raw !== null) {
      divisor = isDateLike(cell) ? 1 : timeDivisor(headers[columns.t] ?? "", raw);
      divisorSettled = true;
    }

    const at = raw === null ? null : raw / divisor;
    if (firstTime === null && at !== null) firstTime = at;

    rows.push({
      t: at === null || firstTime === null ? i - 1 : at - firstTime,
      lat: columns.lat === -1 ? null : toNumber(cells[columns.lat]),
      lon: columns.lon === -1 ? null : toNumber(cells[columns.lon]),
      altitude: columns.altitude === -1 ? null : toNumber(cells[columns.altitude]),
      speed: columns.speed === -1 ? null : toNumber(cells[columns.speed]),
      batteryPercent:
        columns.batteryPercent === -1 ? null : toNumber(cells[columns.batteryPercent]),
      voltage: columns.voltage === -1 ? null : toNumber(cells[columns.voltage]),
      satellites: columns.satellites === -1 ? null : toNumber(cells[columns.satellites]),
    });
  }

  // A row of zeroes for lat/lon is the null island, not a position — DJI logs
  // routinely start with them before the first fix.
  for (const row of rows) {
    if (row.lat === 0 && row.lon === 0) {
      row.lat = null;
      row.lon = null;
    }
  }

  return { error: null, samples: rows, summary: summarise(rows), unmatchedHeaders };
}

/**
 * Narrows a stored track from JSON back into points.
 *
 * The column is jsonb, so what comes back is `Json` — anything at all. A cast
 * would let a malformed row reach the plot and throw there, well away from the
 * cause, so each point is checked and anything unusable is dropped rather than
 * trusted.
 */
export function readStoredTrack(
  value: unknown,
): { t: number; lat: number; lon: number; alt: number | null }[] | null {
  if (!Array.isArray(value)) return null;

  const points = value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const p = entry as Record<string, unknown>;
    const lat = typeof p.lat === "number" ? p.lat : null;
    const lon = typeof p.lon === "number" ? p.lon : null;
    if (lat === null || lon === null) return [];
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
    return [
      {
        t: typeof p.t === "number" ? p.t : 0,
        lat,
        lon,
        alt: typeof p.alt === "number" ? p.alt : null,
      },
    ];
  });

  // One point is not a track, and the plot says so more clearly than a
  // single dot would.
  return points.length > 1 ? points : null;
}
