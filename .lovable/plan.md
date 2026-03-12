

# Fix: Supervisor Cannot Change "Bars to Load" During Active Run

## Problem
During an active run, the "Bars to Load" display shows `lockedBars` (from slot tracker, e.g. 6) but the internal `bars` state may be at `maxBars` (12). When a supervisor presses +/-, the buttons either appear disabled (because `bars >= maxBars` at the bounds) or the display doesn't change (because it renders `lockedBars` not `bars`). This makes the controls appear broken.

## Root Cause (CutEngine.tsx)
Two issues in the same component:

1. **Display mismatch** — Line 237: `{isRunning && lockedBars != null ? lockedBars : bars}` always shows `lockedBars` during a run, so any supervisor override to `bars` is invisible.

2. **State desync** — The `bars` state is never synced to `lockedBars` when a run starts, so internal `bars` can be at `maxBars` while `lockedBars` shows a lower number, causing the increment button to be disabled at the boundary.

## Fix — `src/components/shopfloor/CutEngine.tsx`

**Change 1**: When supervisor mode is active and running, display `bars` (the editable value) instead of `lockedBars`:
```typescript
// Line 237 — change the display logic
{isRunning && lockedBars != null && !isSupervisor ? lockedBars : bars}
```

**Change 2**: Sync `bars` state to `lockedBars` when a run starts, so the supervisor starts editing from the actual loaded value:
```typescript
// Add a useEffect after existing effects (~line 78)
useEffect(() => {
  if (isRunning && lockedBars != null && !operatorOverride) {
    setBars(lockedBars);
  }
}, [isRunning, lockedBars]);
```

This ensures: (a) supervisors see the value they're actually editing, and (b) the internal state starts from the real loaded bar count, not a stale pre-run value.

