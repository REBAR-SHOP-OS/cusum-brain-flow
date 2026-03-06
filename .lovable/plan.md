

# Fix: CutEngine allows bars beyond maxBars

## Problem
In `CutEngine.tsx` line 62, when `runPlan.feasible` is true, bars are set to `runPlan.barsThisRun` **without clamping** to `maxBars`. This causes the UI to display 10 bars when max capacity is 8, which is confusing even though `handleLockAndStart` clamps server-side.

## Fix — 1 file

### `src/components/shopfloor/CutEngine.tsx`

**Line 62** — Clamp `runPlan.barsThisRun` to `maxBars`:
```tsx
// Before:
setBars(runPlan.barsThisRun);

// After:
setBars(Math.min(runPlan.barsThisRun, maxBars));
```

**Line 248 (canStart)** — Add guard to prevent starting when bars exceed max:
```tsx
const canStart = canWrite && !isRunning && !isDone && bars <= maxBars && (isFeasible || runPlan?.stockSource === "manual");
```

This ensures:
1. The UI never displays a bar count exceeding machine capacity
2. The "LOCK & START" button is disabled if bars somehow exceed max
3. The server-side clamp in `handleLockAndStart` remains as a safety net

