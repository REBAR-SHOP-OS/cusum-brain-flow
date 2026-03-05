

# Fix: Allow Bar Count Adjustment Before First Stroke + Abort Run

## Problem
The screenshot shows 6 bars loaded on a running job where the dynamic max should be 5 (for 2395mm cut on 12M stock). Once "LOCK & START" is pressed, the bar count buttons are disabled (`isRunning` check), with no way to abort or correct the mistake. There's also no abort/stop mechanism at all.

## Two Issues to Fix

### 1. Enforce dynamic maxBars on LOCK & START
The `handleLockAndStart` function doesn't validate that the requested bar count is within the dynamic limit. Even though the UI buttons should prevent going over, the run plan or a race condition can still set bars above the dynamic max.

**Fix in `CutterStationView.tsx` `handleLockAndStart`**: Clamp the bars value before starting:
```typescript
const clampedBars = Math.min(bars, maxBars);
```
Use `clampedBars` for all downstream calls.

### 2. Add "Abort Run" capability (before any strokes are recorded)
Allow operators to abort a run if no strokes have been recorded yet, so they can fix the bar count and restart.

**Changes in `CutterStationView.tsx`**:
- Add `handleAbortRun` function that:
  - Calls `manageMachine({ action: "stop-run", machineId })` (or updates the machine_runs record to `aborted`)
  - Resets `isRunning`, `activeRunId`, `completedAtRunStart`, and `slotTracker.reset()`
  - Only available when `slotTracker.totalCutsDone === 0`

**Changes in `CutEngine.tsx`**:
- When `isRunning && strokesDone === 0`, show an "Abort" button instead of disabling bar controls
- Pass `onAbort` callback prop from CutterStationView

### 3. Also show dynamic max in the info text
Currently shows "Max capacity: 8" (static). Should show the dynamic max so the operator knows the real limit.

**Fix in `CutEngine.tsx`**: The `maxBars` prop already reflects the dynamic value — verify the info text uses it (it does via the `maxBars` prop, line ~238).

## Summary
- Clamp bars at `handleLockAndStart` to enforce the dynamic limit
- Add abort capability when no strokes have been recorded
- Both changes in `CutterStationView.tsx` and `CutEngine.tsx`

