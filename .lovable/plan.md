

# Fix Frontend Issues: Workbox Precache, LiveKit/Vizzy Connection, and Supabase Errors

## 1. Workbox Precache Conflict (Low Effort, High Confidence)

The `includeAssets` array in `vite.config.ts` lists `favicon.png`, `pwa-icon-192.png`, and `pwa-icon-512.png`. These same files are also matched by the `globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]` pattern, causing duplicate precache entries.

**Fix:** Add `globIgnores` to the workbox config to exclude the files already listed in `includeAssets`:

```typescript
workbox: {
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
  globIgnores: ["**/pwa-icon-*.png", "**/favicon.png"],
  navigateFallbackDenylist: [/^\/~oauth/, /^\/~lovable/],
  // ...rest unchanged
}
```

**File:** `vite.config.ts` (line ~65, add `globIgnores` after `globPatterns`)

---

## 2. Vizzy WebRTC-First Strategy with Immediate WebSocket Fallback (Medium Effort, Medium Confidence)

Currently, the initial connection always tries WebRTC. If it fails within 5 seconds, the user sees "Connection lost" and must manually tap to reconnect (which then uses WebSocket). This is a poor UX.

**Fix:** On initial connection, try WebRTC first. If disconnected within 5 seconds, automatically retry once with WebSocket using the cached signed URL -- no manual tap required.

Changes in `src/pages/VizzyPage.tsx`:

- In `onDisconnect` (line ~263): When session < 5s and `useWebSocketFallbackRef` flips to true, instead of just setting `status: "error"`, trigger an automatic reconnect immediately (since we already have the signed URL cached from the initial token fetch).
- Change from:
  ```typescript
  useWebSocketFallbackRef.current = true;
  setStatus("error");
  ```
  To:
  ```typescript
  useWebSocketFallbackRef.current = true;
  if (cachedSignedUrlRef.current) {
    setStatus("reconnecting");
    setTimeout(() => reconnectRef.current(), 1000);
  } else {
    setStatus("error");
  }
  ```

This gives users a seamless experience: WebRTC attempt fails silently, WebSocket kicks in automatically within 1-2 seconds.

**File:** `src/pages/VizzyPage.tsx` (lines 263-268)

---

## 3. Supabase REST 400 Errors (Low Effort, High Confidence)

These are typically caused by queries against tables/columns not yet reflected in the TypeScript types, or by malformed PostgREST syntax. Since the Supabase client is auto-configured with correct headers, the fix is to audit any recent queries that may reference columns or tables that don't exist yet (e.g., after a migration that hasn't propagated to types).

**Fix:** No config change needed. This is a code-by-code fix. The most common cause in this project is querying the `email_automations` table before the types file updates. The types file regenerates automatically after migration, so this should self-resolve. If specific 400 errors persist, we trace the exact endpoint from console logs.

**No file changes for this item** -- it's a monitoring/verification step.

---

## Summary of File Changes

| File | Change | Effort |
|------|--------|--------|
| `vite.config.ts` | Add `globIgnores` to prevent duplicate precache entries | Low |
| `src/pages/VizzyPage.tsx` | Auto-retry with WebSocket when WebRTC fails < 5s (instead of showing error) | Low |

Two small, targeted edits that address the highest-impact issues from the diagnostic summary.

