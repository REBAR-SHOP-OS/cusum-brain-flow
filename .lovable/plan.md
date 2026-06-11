## Problem

The toast "Something went wrong — Failed to update a ServiceWorker for scope ('https://id-preview--ef512187-…lovable.app/')" appears intermittently on `/social-media-manager` and other routes.

Root cause:
- `src/lib/browserNotification.ts` registers `/sw-push.js` via `navigator.serviceWorker.register("/sw-push.js")` whenever a user has granted notification permission.
- It is called from `useNotifications.ts` and `SupportInbox.tsx` on every session, including inside the Lovable preview iframe (`id-preview--<uuid>.lovable.app`).
- The preview origin changes between sandbox restarts, the SW script URL can 30x-redirect, and the browser later runs a background `update()` against the old scope. That background update fails and surfaces as an unhandled rejection: `Failed to update a ServiceWorker for scope (...)`.
- The global error handler already lists `"Failed to update a ServiceWorker"` in its ignore patterns, but the error fires from the browser's background SW update (not from our awaited `register()` call), and at least one path still slips through as a generic toast. The right fix is to never register the SW in preview in the first place — per the project's PWA guidance, service workers must not register in Lovable preview/dev contexts. Web-push messaging SWs are an exception, but they should still be gated to real production origins where the scope is stable.

## Fix (surgical, additive, safe)

### 1) Gate push SW registration to production origins only — `src/lib/browserNotification.ts`

Add a small `isProductionOrigin()` helper and bail out of `registerPushSubscription()` early when not on a stable production host.

Allowed origins (push registration runs):
- `erp.rebar.shop` (custom domain)
- `cusum-brain-flow.lovable.app` (published Lovable domain)

Blocked origins (push registration is a no-op):
- `id-preview--*.lovable.app` (Lovable preview iframe — the source of the error)
- `localhost` / `127.0.0.1` (local dev)
- any other `*.lovable.app` sandbox host

Behavior:
- `registerPushSubscription()` returns early with a single `console.log("Push registration skipped: non-production origin", host)` — no SW register call, no DB write, no error to swallow.
- `requestNotificationPermission()` and `showBrowserNotification()` are left untouched — in-page notifications and the permission prompt still work in preview, only the background SW registration is skipped.

No call-site changes needed in `useNotifications.ts` or `SupportInbox.tsx` — both just call the helper and the gate is internal.

### 2) Belt-and-suspenders on the global handler — `src/hooks/useGlobalErrorHandler.ts`

Keep the existing ignore patterns and add two more to cover the exact shapes the browser emits from background SW update failures:

- `"ServiceWorker script"` (covers `"ServiceWorker script ... fetch failed"`)
- `"sw-push.js"` (any failure that names our SW script directly)

This is defense-in-depth; the registration gate in step 1 should make these unreachable on preview from now on.

### 3) Verification

- Reload preview, confirm no `/sw-push.js` request in network tab and no "Failed to update a ServiceWorker" toast.
- Confirm `console.log("Push registration skipped: non-production origin id-preview--…lovable.app")` appears once on `useNotifications` mount.
- Confirm `cusum-brain-flow.lovable.app` (published) and `erp.rebar.shop` still register the SW and write to `push_subscriptions` (no code path change for those hosts).
- Confirm support inbox push still works on production (`SupportInbox.tsx` path).

### Out of scope

- No change to `sw-push.js` itself, the `get-vapid-public-key` edge function, the `push_subscriptions` table, or any RLS.
- No change to `useNotifications.ts` or `SupportInbox.tsx` (the call sites stay; only the helper gates itself).
- No change to manifest/PWA installability — this project is not an installable PWA, only web-push.

### Files touched

```
src/lib/browserNotification.ts          # add isProductionOrigin() gate at top of registerPushSubscription()
src/hooks/useGlobalErrorHandler.ts      # add 2 extra ignore patterns (defense-in-depth)
```
