

## Problems Found

**Bug 1 — CutEngine "Bars to Load" desync during run**: The SlotTracker shows 3 bars loaded (correct — that's what was locked), but CutEngine shows "1 BARS". The CutEngine has its own local `bars` state that can drift from the actual locked bars because `suggestedBars` prop changes mid-run as `barsStillNeeded` decreases with each cut. Although the sync `useEffect` guards with `isRunning`, any brief state inconsistency or re-mount can cause the displayed count to diverge.

**Bug 2 — "Each stroke = 0 pieces (0 bar × 1 cut)"**: After all slots complete, `activeSlots.length = 0`, so the text reads "0 pieces". This is cosmetic but confusing — should hide when no active slots remain.

## Fix

### `src/components/shopfloor/CutEngine.tsx`
- Accept a new prop `lockedBars?: number` — the actual bars count that was locked at run start
- When `isRunning && lockedBars != null`, display `lockedBars` instead of the local `bars` state in the "Bars to Load" section
- This ensures the displayed count always matches what the SlotTracker is using

### `src/components/shopfloor/CutterStationView.tsx`
- Pass `lockedBars={slotTracker.slots.length}` to CutEngine when running
- This is the authoritative source — `slotTracker.startWithBars(bars)` created exactly this many slots

### `src/components/shopfloor/SlotTracker.tsx`
- Hide "Each stroke = X pieces" line when `activeSlots.length === 0` (all done)

