

# Fix: "Machine already has an active run" Race Condition

## Root Cause
The `handleLockAndStart` function sets `isRunning = true` (line 273) but there is **no guard** preventing a second call before the first `manageMachine()` resolves. Double-tapping the Start button fires two `start-run` requests — the first succeeds and sets `current_run_id`, the second hits it and returns the 400 error.

Evidence: Run history shows duplicate runs created within 1 second (18:44:49 and 18:44:50), both later canceled.

**Current machine state is clean** — CUTTER-01 is idle with no stuck runs.

## Fix (2 changes)

### 1. Frontend: Add `useRef` guard to prevent double-fire
In `CutterStationView.tsx`, add a `startingRef` that blocks re-entry:

```typescript
const startingRef = useRef(false);

const handleLockAndStart = async (stockLength: number, bars: number) => {
  if (!currentItem || startingRef.current) return;  // ← guard
  startingRef.current = true;
  try {
    // ... existing logic
  } catch { ... }
  finally {
    startingRef.current = false;  // ← always release
  }
};
```

### 2. Backend: Reduce stale threshold for rapid retries
In `manage-machine` edge function, add a short-circuit for runs under 5 seconds old with same machine — treat the existing run as "already started successfully" and return its ID instead of erroring:

```typescript
// After fetching existingRun, before the stale check:
const AGE_MS = Date.now() - new Date(existingRun.started_at).getTime();
if (AGE_MS < 5000) {
  // Likely a double-tap — return success with existing run ID
  return { machineRunId: existingRun.id };
}
```

This makes double-taps idempotent rather than erroring.

## Files Changed
- `src/components/shopfloor/CutterStationView.tsx` — add `startingRef` guard
- `supabase/functions/manage-machine/index.ts` — add <5s idempotency in both `startRun` and `startQueuedRun` handlers

