

## Fix: Add "Stop Run" option for mid-run scenarios

### Problem
The operator is stuck mid-run (1/5 pieces done):
- **Abort** button disappears after the first stroke (`strokesDone === 0` guard)
- **Complete Run** button only appears when all slots are done (`allDone` guard)
- **LOCK & START** shows "Machine busy" toast because the DB still has an active run
- There is no way to stop or force-complete a run that's in progress

### Plan

**1. Add "STOP RUN" button to SlotTracker** (`src/components/shopfloor/SlotTracker.tsx`)
- Show a "Stop Run (X pcs)" button alongside "Record Stroke" when `totalCutsDone > 0 && !allDone`
- Uses `onCompleteRun` callback (same as normal completion) — the handler already records partial output
- Styled as destructive/outline to distinguish from the primary stroke button
- Only visible when `canWrite` is true

**2. Add "STOP RUN" button to CutEngine** (`src/components/shopfloor/CutEngine.tsx`)
- When `isRunning && strokesDone > 0`, show a secondary "Stop Run" button below the "Machine Active" badge
- Calls a new `onStopRun` callback (same as `onAbort` but for mid-run)

**3. Update CutterStationView handler** (`src/components/shopfloor/CutterStationView.tsx`)
- The existing `handleCompleteRun` already handles partial runs correctly (uses `slotTracker.totalCutsDone` as output)
- No logic changes needed — just wire the stop button to `handleCompleteRun`

### Changes Summary

| File | Change |
|---|---|
| `SlotTracker.tsx` | Add "Stop Run" button next to "Record Stroke" when mid-run |
| `CutEngine.tsx` | Add `onStopRun` prop; show stop button when `strokesDone > 0` |
| `CutterStationView.tsx` | Pass `handleCompleteRun` as `onStopRun` to CutEngine |

