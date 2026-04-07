

# Fix: Lock "Bars to Load" After First Supervisor Confirmation

## Problem
When a supervisor confirms manual floor stock (or any action that triggers a run plan recalculation), the "Bars to Load" value recalculates because `operatorOverride` is only set by the +/- buttons, not by the confirmation action. This causes the bars count to shift unexpectedly after the supervisor has already seen and implicitly accepted a value.

## Root Cause
In `CutEngine.tsx` (lines 64-71), the `useEffect` syncs `bars` from `runPlan.barsThisRun` whenever the plan changes — unless `operatorOverride` is `true`. But `operatorOverride` is only set when the supervisor manually clicks +/- on the bars counter. The floor stock confirmation and other supervisor actions don't set this flag, so bars drift on recompute.

## Fix

### `CutEngine.tsx` — Freeze bars after first supervisor-triggered value is set

Add a `barsLocked` ref that gets set to `true` after the first time `bars` is populated from a valid run plan. Once locked, the sync effect no longer overwrites the value — only manual +/- or a new item (barCode change) can change it.

```typescript
// New ref
const barsLocked = useRef(false);

// Modified sync effect (lines 64-71)
useEffect(() => {
  if (isRunning || operatorOverride || barsLocked.current) return;
  if (runPlan?.feasible) {
    setBars(Math.min(runPlan.barsThisRun, maxBars));
    barsLocked.current = true;  // Lock after first valid plan
  } else if (suggestedBars && suggestedBars > 0) {
    setBars(Math.min(suggestedBars, maxBars));
    barsLocked.current = true;
  }
}, [runPlan?.barsThisRun, runPlan?.feasible, suggestedBars, maxBars, isRunning, operatorOverride]);

// Reset lock on item change (modify existing effect at lines 73-78)
useEffect(() => {
  if (!isRunning) {
    setOperatorOverride(false);
    barsLocked.current = false;  // Unlock for new item
  }
}, [barCode, isRunning]);
```

This ensures:
- First run plan computation sets the bars value and locks it
- Subsequent run plan recalculations (e.g., after floor stock confirm) do NOT change bars
- Navigating to a new item or completing a run resets the lock
- Manual +/- still works (already sets `operatorOverride`)

## Files Changed

| File | Change |
|------|--------|
| `src/components/shopfloor/CutEngine.tsx` | Add `barsLocked` ref, freeze after first valid plan (~4 lines changed) |

## Impact
- "Bars to Load" stays constant after the first supervisor/system sets it
- No database, auth, or schema changes
- Manual override via +/- buttons still works as before

