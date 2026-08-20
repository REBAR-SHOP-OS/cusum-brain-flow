// Kill-switch service worker.
//
// A previous build of this app (or the Lovable preview environment) registered
// a service worker at `/sw.js`. The current app does NOT use `/sw.js` — only
// `/sw-push.js` for web push, which is gated to production origins.
//
// Browsers that still have the old `/sw.js` registration will keep trying to
// update it in the background. When the request 30x-redirects (Lovable's SPA
// fallback), the browser throws:
//   TypeError: Failed to update a ServiceWorker for scope (...): The script
//   resource is behind a redirect, which is disallowed.
//
// This file serves a real, non-redirected response so the update succeeds —
// and the new worker immediately unregisters itself and purges any caches it
// owns. Once every visitor has fetched this file once, the legacy registration
// is gone for good.
//
// DO NOT add app-shell caching here. This file's only job is cleanup.

self.addEventListener("install", (event) => {
  // Take over from the old worker immediately.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Purge any caches the old worker created.
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) {
        // best-effort
      }
      try {
        // Unregister so the browser stops polling /sw.js forever.
        await self.registration.unregister();
      } catch (_) {
        // best-effort
      }
      try {
        // Force any open clients to drop the controller and reload cleanly.
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          try {
            client.navigate(client.url);
          } catch (_) {
            // ignore
          }
        }
      } catch (_) {
        // best-effort
      }
    })()
  );
});

// Never intercept fetches — pass through to the network.
self.addEventListener("fetch", () => {});
