

# Fix: "Bars to Load" Changes Not Reflected in Slot Tracker

## Problem

When the operator changes "BARS TO LOAD" (e.g., from 1 to 4), the Slot Tracker still shows "1 BARS LOADED". This happens because:

1. The bar count spinner in the Cut Engine is **not disabled while a run is active** -- operators can change it mid-run
2. `slotTracker.startWithBars(bars)` is only called once during "LOCK & START" -- subsequent bar changes are ignored by the Slot Tracker
3. Physically, you cannot add/remove bars mid-cut, so the spinner should be locked during a run

## Fix

### 1. Disable Bar Count Changes While Running

In `CutEngine.tsx`, add `isRunning` to the disabled condition on both the increment and decrement bar buttons. This prevents operators from changing bars after locking, which matches physical reality.

### 2. Ensure Correct Initial Bar Count

The current flow already passes `bars` correctly to `onLockAndStart` -- the issue is only that post-lock changes aren't synced. Disabling the spinner during a run fully resolves this.

## Technical Details

### File: `src/components/shopfloor/CutEngine.tsx`

**Change 1** -- Decrement button (line 213): Add `|| isRunning` to `disabled`

```
disabled={bars <= 1 || isRunning}
```

**Change 2** -- Increment button (line 231): Add `|| isRunning` to `disabled`

```
disabled={bars >= maxBars || isRunning}
```

This is a two-line change. No other files need modification.
