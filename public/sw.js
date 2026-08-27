/*
 * Service worker for field use.
 *
 * Deliberately narrow. It caches the application shell so the portal opens at
 * a pit face with no signal, and it does NOT cache operational data: a crew
 * shown yesterday's maintenance status as though it were current is worse off
 * than a crew shown nothing. Anything under /api/ or /auth/ is never touched.
 *
 * Writes are not handled here. A queued flight lives in IndexedDB and is filed
 * by the page when the connection returns — Background Sync would be neater,
 * but it is unsupported on iOS, which is half a survey crew.
 */

const VERSION = "v1";
const SHELL = `sky-lounge-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      // A precache miss must not stop the worker installing; the offline page
      // is a courtesy, not a dependency.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never serve stale operational data or interfere with authentication.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return (
          cached ??
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
        );
      }),
    );
    return;
  }

  // Static build output is content-hashed, so a cache hit is always correct.
  if (url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
