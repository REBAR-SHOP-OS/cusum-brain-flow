

# Fix: Vizzy Voice Connection Error

## Root Cause

Two issues found:

1. **Edge function stale deployment**: The `voice-engine-token` edge function was in a broken state — logs only showed "shutdown" with no "booted" messages. After redeployment, it boots and responds correctly. This is already fixed.

2. **Unhandled promise rejection crashes React**: In `useVizzyVoiceEngine.ts` (lines 537, 543), `originalStartSession()` is an async function called without `await` or `.catch()`. When the edge function fails (e.g., network error, stale deployment), the rejected promise is unhandled, causing the React error overlay ("The app encountered an error").

## Fix

### File: `src/hooks/useVizzyVoiceEngine.ts` (lines 534-543)

Add `.catch()` to both `originalStartSession()` calls to prevent unhandled rejections:

```typescript
// Line 537
originalStartSession().catch((e) => console.warn("[VizzyVoice] session start failed:", e));

// Line 543
originalStartSession().catch((e) => console.warn("[VizzyVoice] session start failed:", e));
```

The voice engine's own `startSession` already has a try/catch that sets state to "error" and shows a toast — but Promise rejections from async functions still need to be caught at the call site when not awaited.

### Edge function redeployment (already done)

The `voice-engine-token` function has been redeployed and is responding correctly.

## Impact

- Prevents React crash overlay when voice connection fails
- Error state is handled gracefully (toast + retry button still work)
- No changes to any other logic or behavior

## Files Changed
- `src/hooks/useVizzyVoiceEngine.ts` — add `.catch()` to two fire-and-forget `originalStartSession()` calls

