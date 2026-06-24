## Root cause

A previous build registered a ServiceWorker at `/sw.js` for the preview origin (`id-preview--…lovable.app`). The current code no longer uses it, but the browser keeps the old registration and silently re-fetches `/sw.js` to update it.

On preview origins, `/sw.js` now returns **HTTP 302 → `lovable.dev/auth-bridge?...`** (verified via curl). The Service Worker spec forbids redirects on the script resource, so Chromium throws:

```
TypeError: Failed to update a ServiceWorker for scope (...): The script resource is behind a redirect, which is disallowed.
```

This surfaces as:
1. The red "Something went wrong / Failed to update a ServiceWorker…" toast (Lovable preview's runtime-error overlay reading `unhandledrejection`).
2. A repeating entry in our app logs.

Today's mitigations don't fully work in preview:
- `registerServiceWorker.ts` calls `unregisterStaleAppSW()` only at boot. Chromium queues background updates anyway, and unregister can be deferred while the SW still controls an open client.
- `useGlobalErrorHandler` filters this message, but it mounts inside React (after Lovable's preview collector has already received the event), and Lovable's overlay is outside our app.
- The kill-switch `public/sw.js` is correct, but it never reaches the browser because preview redirects the request.

## Fix (safe, additive, non-destructive)

Surgical changes only. No schema, no business logic, no routes touched.

### 1. `src/main.tsx` — earliest possible suppression + cleanup

Before `registerServiceWorker()` and before `createRoot`, install a one-shot global guard that runs in the capture phase:

- `window.addEventListener("unhandledrejection", handler, { capture: true })` and a matching `"error"` capture listener.
- If the message contains any of:
  - `"Failed to update a ServiceWorker"`
  - `"Failed to register a ServiceWorker"`
  - `"script resource is behind a redirect"`
  - `"/sw.js"`
  
  call `event.preventDefault()` **and** `event.stopImmediatePropagation()`. This stops Lovable's preview overlay listener from receiving it (it's the source of the toast) and prevents the entry in runtime logs.
- Listener stays registered for the lifetime of the page (no removal) so it also covers background updates that fire minutes later.

### 2. `src/lib/pwa/registerServiceWorker.ts` — make cleanup more aggressive

Keep current behavior, but harden `unregisterStaleAppSW`:

- Unregister **every** existing registration whose `scope` matches `window.location.origin + "/"` OR whose script URL path is `/sw.js` (current check only matches the latter via `endsWith` and can miss installing/redundant workers).
- After unregister, also `caches.keys()` → `caches.delete(...)` to drop any app-shell caches the old worker created.
- Run this on every page load on preview origins (already gated by `shouldRefuseRegistration`).

### 3. Regression test

Add `tests/regression/pwa/sw-redirect-error-suppressed.test.ts`:

- Simulate an `unhandledrejection` whose `reason` is a `TypeError` with the SW redirect message.
- Assert `defaultPrevented === true` after the main.tsx guard runs.
- Assert the message is in the ignore list of `useGlobalErrorHandler` (already true; lock it in).

### 4. Verification steps after build mode

- Re-load preview, confirm no "Something went wrong / Failed to update a ServiceWorker…" toast appears.
- DevTools → Application → Service Workers: legacy `/sw.js` registration is gone after one reload.
- Run `vitest` on the new regression test.

## Technical notes

- The kill-switch `public/sw.js` stays in place — it still works on production/custom-domain origins where `/sw.js` is served directly (no auth-bridge redirect), so any user that lands on the production origin completes the cleanup naturally.
- No change to `public/sw-push.js` (web-push worker), no change to `_headers` / `_redirects`, no PWA install behavior change.
- Filter is scoped narrowly to ServiceWorker-redirect strings to avoid masking unrelated rejections.

## Out of scope

- Removing `public/sw.js` (still needed for production cleanup).
- Touching Lovable preview's auth-bridge redirect (not under our control).
- Any UI / business logic change.
