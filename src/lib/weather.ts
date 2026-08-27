/**
 * Aerodrome weather observations.
 *
 * A free-text weather field records what somebody remembered. A METAR records
 * what was actually observed at a named station at a named time, which is the
 * difference between a note and evidence.
 *
 * Observations come from the NOAA aviation weather service, which serves
 * Canadian stations and needs no key. The parsing lives here, separate from
 * the fetch, because an external response shape is exactly the kind of thing
 * that changes quietly — this way a change breaks a test rather than a flight
 * record.
 */

export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR";

export type Observation = {
  station: string;
  observedAt: string | null;
  windDirectionDeg: number | null;
  windSpeedKt: number | null;
  temperatureC: number | null;
  visibilitySm: number | null;
  flightCategory: FlightCategory | null;
  raw: string | null;
  stationName: string | null;
};

const CATEGORIES: FlightCategory[] = ["VFR", "MVFR", "IFR", "LIFR"];

/** Canadian ICAO identifiers are four letters; most begin with C. */
export function isValidStationId(id: string): boolean {
  return /^[A-Z]{4}$/.test(id.trim().toUpperCase());
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // The service reports visibility as strings like "20" or "10+" for
  // unlimited, so a bare parse would drop the useful part of both.
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace("+", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function int(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : Math.round(n);
}

/**
 * Turns one raw record from the service into an observation.
 *
 * Returns null rather than a half-filled object when the record has no station
 * or no raw report, because an observation that cannot say where it came from
 * is not worth attaching to a flight.
 */
export function parseObservation(record: unknown): Observation | null {
  if (typeof record !== "object" || record === null) return null;
  const r = record as Record<string, unknown>;

  const station = typeof r.icaoId === "string" ? r.icaoId.toUpperCase() : null;
  if (!station) return null;

  const rawCategory = typeof r.fltCat === "string" ? r.fltCat.toUpperCase() : null;
  const flightCategory =
    rawCategory && (CATEGORIES as string[]).includes(rawCategory)
      ? (rawCategory as FlightCategory)
      : null;

  // reportTime is an ISO string; obsTime is a unix seconds fallback.
  let observedAt: string | null = null;
  if (typeof r.reportTime === "string") {
    const d = new Date(r.reportTime.replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) observedAt = d.toISOString();
  }
  if (!observedAt && typeof r.obsTime === "number") {
    const d = new Date(r.obsTime * 1000);
    if (!Number.isNaN(d.getTime())) observedAt = d.toISOString();
  }

  // Variable wind is reported as "VRB", which is a direction of sorts but not
  // a number — recording it as 0 would claim a northerly.
  const windDirectionDeg = r.wdir === "VRB" ? null : int(r.wdir);

  return {
    station,
    observedAt,
    windDirectionDeg,
    windSpeedKt: int(r.wspd),
    temperatureC: num(r.temp),
    visibilitySm: num(r.visib),
    flightCategory,
    raw: typeof r.rawOb === "string" ? r.rawOb : null,
    stationName: typeof r.name === "string" ? r.name : null,
  };
}

/** The most recent usable observation from a service response. */
export function parseObservations(payload: unknown): Observation | null {
  if (!Array.isArray(payload)) return null;
  for (const record of payload) {
    const observation = parseObservation(record);
    if (observation) return observation;
  }
  return null;
}

/** A one-line summary for the flight log's free-text weather field. */
export function summarise(observation: Observation): string {
  const parts: string[] = [];

  if (observation.windSpeedKt !== null) {
    if (observation.windSpeedKt === 0) {
      parts.push("calm");
    } else if (observation.windDirectionDeg !== null) {
      parts.push(`${observation.windDirectionDeg}° at ${observation.windSpeedKt} kt`);
    } else {
      parts.push(`variable ${observation.windSpeedKt} kt`);
    }
  }
  if (observation.temperatureC !== null) parts.push(`${observation.temperatureC}°C`);
  if (observation.visibilitySm !== null) parts.push(`${observation.visibilitySm} SM`);
  if (observation.flightCategory) parts.push(observation.flightCategory);

  return parts.length > 0 ? parts.join(", ") : "Observation recorded";
}
