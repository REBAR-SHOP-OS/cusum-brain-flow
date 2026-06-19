# Fix: "Failed to update a ServiceWorker … script resource is behind a redirect"

## What the error actually is

The browser is trying to **auto-update a previously-installed `/sw.js`** that lives in users' browsers from older builds of the app. On the Lovable preview origin (`id-preview--…lovable.app`), the request for `/sw.js` is being **30x-redirected to the SPA fallback** (`/index.html`), which the Service Worker spec forbids — the browser aborts the update and logs:

> TypeError: Failed to update a ServiceWorker for scope ('https://id-preview--…/') with script ('/sw.js'): The script resource is behind a redirect, which is disallowed.

This is **not** caused by today's upload code. The video upload (WebM passthrough + 45 s normalize timeout) is already fixed; the SW noise just happens to fire while the upload UI is on screen, so it looks related.

There are two real problems to solve, both safely and additively:

1. `/sw.js` must be served as a real file, **never** as a redirect — even on preview hosts. The repo already ships a kill-switch `public/sw.js`, but the catch-all rewrite in `public/_redirects` (`/* /index.html 200`) plus the preview CDN's behavior can mask it.
2. On non-production origins, **every** legacy SW registration (`/sw.js` *and* `/sw-push.js`) should be unregistered immediately so the browser stops polling for updates at all.

## Changes (surgical, additive)

### 1. `public/_redirects` — force-serve SW scripts before the SPA fallback

Add explicit 200-pass rules above the catch-all so the CDN cannot rewrite them to `index.html`:

```
/sw.js          /sw.js          200
/sw-push.js     /sw-push.js     200
/*              /index.html     200
```

Rationale: Netlify-style `_redirects` is evaluated top-down. Explicit rules win over `/*`. This guarantees the kill-switch worker is delivered as a real script with a 200 status on every host, so the browser's update check succeeds and the worker can self-unregister.

### 2. `src/lib/pwa/registerServiceWorker.ts` — broaden the stale unregister

Currently `unregisterStaleAppSW` only unregisters workers whose script ends in `/sw.js`. On preview/iframe/non-prod hosts we should unregister **all** workers under our scope, including `/sw-push.js` left over from a prior visit to the production host on the same device.

Change inside `shouldRefuseRegistration === true` branch only — production behavior is untouched:

```ts
async function unregisterAllAppSWs(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
  } catch {
    // best-effort
  }
}
```

And call `unregisterAllAppSWs()` instead of `unregisterStaleAppSW()` when `shouldRefuseRegistration()` returns true. Keep `unregisterStaleAppSW` available (unused) only if other call sites need it — otherwise remove it in the same change to satisfy the dead-code rule.

### 3. `src/hooks/useGlobalErrorHandler.ts` — confirm noise stays silenced

The ignore list already contains `"Failed to update a ServiceWorker"`, `"script resource is behind a redirect"`, `"sw.js"`, and `"sw-push.js"`. No change needed; this is a verification step, not an edit.

## What is NOT changed

- No edits to upload code (`igSafeVideo.ts`, `socialMediaStorage.ts`, `PostReviewPanel.tsx`). The WebM fix from the prior turn stands.
- No edits to `public/sw.js` kill-switch — it already does the right thing once it's actually fetched.
- No production behavior change. `registerSW` still runs on `erp.rebar.shop` and `cusum-brain-flow.lovable.app`.

## Verification after build mode

1. Hard-reload preview → DevTools → Application → Service Workers shows **0 registrations** under the preview origin within one page load.
2. Network tab: `/sw.js` returns **200** with the kill-switch script body (not `<!doctype html>`).
3. No "Something went wrong / Failed to update a ServiceWorker" toast appears on `/social-media-manager`.
4. On `erp.rebar.shop`, push registration still works (gated by `isProductionOrigin`).
5. Add a tiny regression test under `tests/regression/` asserting `public/_redirects` contains explicit `/sw.js` and `/sw-push.js` 200 rules above `/*`.

## Files touched

- `public/_redirects` (2 new lines)
- `src/lib/pwa/registerServiceWorker.ts` (replace stale-only unregister with all-SW unregister on refusal path; remove dead helper)
- `tests/regression/pwa/sw-redirects-pass-through.test.ts` (new, ~15 lines)

## Risks

- None for production: only the refusal branch and a CDN routing rule for two static paths change.
- If a future build re-introduces an app-shell SW at `/sw.js`, the kill-switch will unregister it on first load — intentional, and documented in `public/sw.js`.
