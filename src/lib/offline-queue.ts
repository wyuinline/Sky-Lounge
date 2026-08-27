/**
 * Offline capture for flight logs.
 *
 * A survey crew is at a pit face, not at a desk. Logs get filed the next
 * morning from memory, or not at all — which quietly undermines every derived
 * figure downstream, because hours, service intervals and currency are only as
 * good as the logs they are summed from.
 *
 * So the form accepts a flight while offline, holds it, and files it when the
 * connection returns. The decisions about *what* to queue and *when* to flush
 * live here as pure functions; the IndexedDB access is a thin adapter beneath
 * them, because storage is easy to get right and policy is easy to get wrong.
 */

export type QueuedFlight = {
  /** Assigned on the device, so a retry cannot file the same flight twice. */
  id: string;
  /** Serialised form fields — flight logs carry no files, so this is enough. */
  fields: [string, string][];
  queuedAt: string;
  /** How many times filing has been attempted and failed. */
  attempts: number;
  lastError: string | null;
};

/** Beyond this many failures a submission stops being retried automatically. */
export const MAX_ATTEMPTS = 5;

/**
 * Whether a failure is worth retrying.
 *
 * A network failure means the connection went away and the flight is still
 * good. A rejection from the server means the flight itself was refused — an
 * unairworthy aircraft, an unauthorised pilot — and retrying it every time the
 * signal returns would spam the crew with the same refusal forever.
 */
export function shouldRetry(item: QueuedFlight): boolean {
  if (item.attempts >= MAX_ATTEMPTS) return false;
  if (item.lastError === null) return true;
  return item.lastError === NETWORK_ERROR;
}

/** The marker for "the request never reached the server". */
export const NETWORK_ERROR = "__offline__";

/**
 * Splits a queue into what to send now and what to leave alone.
 *
 * Oldest first: a crew filing three flights at the end of a day expects them
 * in the order they flew, and the reminder digest reads better for it.
 */
export function partitionQueue(items: QueuedFlight[]): {
  ready: QueuedFlight[];
  blocked: QueuedFlight[];
} {
  const sorted = [...items].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  return {
    ready: sorted.filter(shouldRetry),
    blocked: sorted.filter((i) => !shouldRetry(i)),
  };
}

/** A short description of the queue, for the indicator in the header. */
export function describeQueue(items: QueuedFlight[]): string | null {
  if (items.length === 0) return null;
  const { ready, blocked } = partitionQueue(items);

  if (blocked.length > 0 && ready.length === 0) {
    return `${blocked.length} flight${blocked.length === 1 ? "" : "s"} could not be filed`;
  }
  if (blocked.length > 0) {
    return `${ready.length} waiting to file, ${blocked.length} rejected`;
  }
  return `${ready.length} flight${ready.length === 1 ? "" : "s"} waiting to file`;
}

/** Rebuilds a FormData from a queued entry. */
export function toFormData(item: QueuedFlight): FormData {
  const formData = new FormData();
  for (const [key, value] of item.fields) formData.append(key, value);
  return formData;
}

/** Captures a FormData for storage, dropping anything that is not text. */
export function fromFormData(formData: FormData): [string, string][] {
  const fields: [string, string][] = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields.push([key, value]);
  }
  return fields;
}

/** A human summary of a queued flight, for the pending list. */
export function summariseQueued(item: QueuedFlight): string {
  const get = (key: string) => item.fields.find(([k]) => k === key)?.[1] ?? "";
  const date = get("flight_date");
  const duration = get("duration_minutes");
  const site = get("location_name");

  const parts = [date || "Undated flight"];
  if (site) parts.push(site);
  if (duration) parts.push(`${duration} min`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Storage adapter
// ---------------------------------------------------------------------------

const DB_NAME = "sky-lounge-offline";
const STORE = "queued-flights";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Every call is wrapped: a browser in private mode, or with site data blocked,
 * throws on open. A crew losing the offline queue is bad; the whole form
 * failing because the queue is unavailable is worse.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[offline] storage unavailable", error);
    return null;
  }
}

export async function listQueued(): Promise<QueuedFlight[]> {
  const all = await withStore<QueuedFlight[]>("readonly", (s) => s.getAll());
  return all ?? [];
}

export async function enqueue(formData: FormData): Promise<QueuedFlight | null> {
  const item: QueuedFlight = {
    id: crypto.randomUUID(),
    fields: fromFormData(formData),
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  const stored = await withStore("readwrite", (s) => s.put(item));
  return stored === null ? null : item;
}

export async function updateQueued(item: QueuedFlight): Promise<void> {
  await withStore("readwrite", (s) => s.put(item));
}

export async function removeQueued(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}
