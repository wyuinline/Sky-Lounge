"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, CloudOff, CloudUpload, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logFlight } from "@/app/(portal)/flights/actions";
import {
  listQueued,
  updateQueued,
  removeQueued,
  partitionQueue,
  describeQueue,
  toFormData,
  summariseQueued,
  NETWORK_ERROR,
  type QueuedFlight,
} from "@/lib/offline-queue";

/**
 * Registers the service worker and files anything the crew captured offline.
 *
 * Mounted once in the portal shell. It is the only thing that flushes the
 * queue, so a flight cannot be filed twice by two components racing each other
 * — and it flushes on reconnect rather than on a timer, because the moment the
 * signal returns is exactly when it matters.
 */
/**
 * Subscribes to the browser's own idea of connectivity.
 *
 * useSyncExternalStore rather than an effect: the server has no navigator, and
 * seeding state from an effect would render "online" for a frame before
 * correcting itself — a flicker on exactly the screen a crew is relying on.
 * The server snapshot is `true`, so the indicator is absent until the browser
 * says otherwise.
 */
function subscribeToConnectivity(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineSync() {
  const [queue, setQueue] = useState<QueuedFlight[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [showList, setShowList] = useState(false);

  const online = useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true,
  );

  const refresh = useCallback(async () => {
    setQueue(await listQueued());
  }, []);

  const flush = useCallback(async () => {
    if (flushing) return;
    setFlushing(true);

    try {
      const { ready } = partitionQueue(await listQueued());
      let filed = 0;

      for (const item of ready) {
        try {
          const result = await logFlight(toFormData(item));
          if (result.error) {
            // The server refused the flight itself, which retrying will not
            // change. Kept so the crew can see why and fix it by hand.
            await updateQueued({
              ...item,
              attempts: item.attempts + 1,
              lastError: result.error,
            });
            toast.error(`Could not file ${summariseQueued(item)}: ${result.error}`);
            continue;
          }
          await removeQueued(item.id);
          filed++;
        } catch {
          // Never reached the server — still a good flight, try again later.
          await updateQueued({
            ...item,
            attempts: item.attempts + 1,
            lastError: NETWORK_ERROR,
          });
          break;
        }
      }

      if (filed > 0) {
        toast.success(`Filed ${filed} flight${filed === 1 ? "" : "s"} captured offline.`);
      }
    } finally {
      setFlushing(false);
      await refresh();
    }
  }, [flushing, refresh]);

  // Held in a ref so the reconnect effect can call the current flush without
  // naming it as a dependency — which would re-run the effect, and re-flush,
  // on every render.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Not fatal: the portal works online without it, and a console line
        // beats a toast nobody in the office can act on.
        console.error("[offline] service worker registration failed", error);
      });
    }

    // Another tab, or the flight dialog, may have queued something.
    window.addEventListener("sky-lounge:queued", refresh);
    return () => window.removeEventListener("sky-lounge:queued", refresh);
  }, [refresh]);

  // Runs on mount and again the moment the signal returns — which is exactly
  // when a held flight should be filed.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (online) {
        await flushRef.current();
        return;
      }
      const items = await listQueued();
      if (!cancelled) setQueue(items);
    })();

    return () => {
      cancelled = true;
    };
  }, [online]);

  const summary = describeQueue(queue);
  const { blocked } = partitionQueue(queue);

  if (online && summary === null) return null;

  return (
    <div
      className="fixed right-4 bottom-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-[var(--control-edge)] bg-[var(--control-face)] p-3 shadow-[var(--control-pop)] print:hidden"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => setShowList((v) => !v)}
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={showList}
      >
        {!online ? (
          <CloudOff className="mt-0.5 size-4 shrink-0 text-[var(--status-warning)]" />
        ) : blocked.length > 0 ? (
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--status-critical)]" />
        ) : (
          <CloudUpload className="mt-0.5 size-4 shrink-0 text-brand-teal" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {online ? "Back online" : "No signal — keep logging"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {summary ?? "Flights you file now are held until the signal returns."}
          </span>
        </span>
        {queue.length > 0 ? (
          <ChevronDown
            className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${
              showList ? "rotate-180" : ""
            }`}
          />
        ) : null}
      </button>

      {showList && queue.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {queue.map((item) => (
            <li key={item.id} className="rounded-md border border-border px-2.5 py-1.5 text-xs">
              <span className="block font-medium">{summariseQueued(item)}</span>
              {item.lastError !== null && item.lastError !== NETWORK_ERROR ? (
                <>
                  <span className="block text-[var(--status-critical)]">{item.lastError}</span>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="mt-1"
                    onClick={async () => {
                      await removeQueued(item.id);
                      await refresh();
                      toast.success("Discarded.");
                    }}
                  >
                    Discard
                  </Button>
                </>
              ) : (
                <span className="block text-muted-foreground">
                  Waiting to file
                  {item.attempts > 0 ? ` · ${item.attempts} attempts` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {online && queue.length > 0 ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          disabled={flushing}
          onClick={() => void flush()}
        >
          {flushing ? "Filing..." : "File now"}
        </Button>
      ) : null}
    </div>
  );
}
