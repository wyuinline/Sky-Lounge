"use server";

import { getAccess } from "@/lib/permissions";
import { isValidStationId, parseObservations, summarise, type Observation } from "@/lib/weather";

const SERVICE = "https://aviationweather.gov/api/data/metar";

/**
 * Fetches the current observation for an aerodrome.
 *
 * Runs on the server rather than in the browser: it keeps the outbound call
 * off the client, avoids a cross-origin request, and means one place to change
 * if the service ever needs a key.
 */
export async function fetchObservation(
  stationId: string,
): Promise<{ error: string; observation: null } | { error: null; observation: Observation; summary: string }> {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in.", observation: null };

  const station = stationId.trim().toUpperCase();
  if (!isValidStationId(station)) {
    return {
      error: "Enter a four-letter aerodrome identifier, such as CYEG.",
      observation: null,
    };
  }

  let response: Response;
  try {
    // A weather lookup is a convenience on a form someone is filling in — it
    // must not hang the dialog if the service is slow.
    response = await fetch(`${SERVICE}?ids=${station}&format=json`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[weather] fetch failed", error);
    return {
      error: "Could not reach the weather service. Enter the conditions by hand.",
      observation: null,
    };
  }

  if (!response.ok) {
    console.error("[weather] service returned", response.status);
    return {
      error: "The weather service did not answer. Enter the conditions by hand.",
      observation: null,
    };
  }

  // An unrecognised identifier comes back as a 200 with a non-JSON body, so a
  // parse failure here means the station was wrong rather than the service
  // being down — and saying "could not reach the service" would send someone
  // chasing a network problem that does not exist.
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      error: `${station} is not a station the weather service knows. Check the identifier.`,
      observation: null,
    };
  }

  const observation = parseObservations(payload);
  if (!observation) {
    return {
      error: `No current observation for ${station}. Check the identifier, or enter the conditions by hand.`,
      observation: null,
    };
  }

  return { error: null, observation, summary: summarise(observation) };
}
