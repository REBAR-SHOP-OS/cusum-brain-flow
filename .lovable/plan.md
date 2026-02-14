
# Fix Vizzy Infinite Reconnection Loop

## Problem

The automatic WebSocket fallback introduced in the last edit created an **infinite reconnection loop**. The logs show:

1. WebRTC connects, agent disconnects after ~1986ms
2. Auto-fallback triggers WebSocket reconnect
3. WebSocket connects, agent disconnects after ~825ms
4. Auto-fallback triggers another WebSocket reconnect (loop continues indefinitely)

The `onDisconnect` handler always enters the `< 5000ms` branch and always finds `cachedSignedUrlRef.current`, so it retries forever.

## Root Cause

The auto-reconnect logic has no counter or guard to limit how many times the automatic fallback fires. The `retryCountRef` is only used in the `> 5s` branch, not in the `< 5s` branch.

## Fix (`src/pages/VizzyPage.tsx`)

Add a dedicated `autoFallbackAttemptedRef` flag that allows **exactly one** automatic WebSocket fallback. After that single attempt, if it still fails under 5 seconds, show the error state (manual "Tap to reconnect" or navigate home).

### Changes

In the `< 5000ms` branch (lines 262-273), replace:

```typescript
useWebSocketFallbackRef.current = true;
if (cachedSignedUrlRef.current) {
  setStatus("reconnecting");
  setTimeout(() => reconnectRef.current(), 1000);
} else {
  setStatus("error");
}
```

With:

```typescript
useWebSocketFallbackRef.current = true;
if (!autoFallbackAttemptedRef.current && cachedSignedUrlRef.current) {
  autoFallbackAttemptedRef.current = true;
  setStatus("reconnecting");
  setTimeout(() => reconnectRef.current(), 1000);
} else {
  setStatus("error");
}
```

Also add the ref declaration near the other refs (~line 20-60 area):

```typescript
const autoFallbackAttemptedRef = useRef(false);
```

And reset it in `onConnect` so a successful connection allows future fallback attempts:

```typescript
onConnect: () => {
  sessionActiveRef.current = true;
  lastConnectTimeRef.current = Date.now();
  autoFallbackAttemptedRef.current = false; // reset on successful connect
  setStatus("connected");
  retryCountRef.current = 0;
},
```

## Summary

| File | Change | Lines |
|------|--------|-------|
| `src/pages/VizzyPage.tsx` | Add `autoFallbackAttemptedRef` declaration | Near existing refs |
| `src/pages/VizzyPage.tsx` | Guard auto-reconnect with the flag | Lines 267-270 |
| `src/pages/VizzyPage.tsx` | Reset flag on successful connect | Line 251 |

One ref, three single-line changes. Stops the infinite loop while preserving the seamless single-attempt fallback behavior.
