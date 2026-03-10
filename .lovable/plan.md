

# Audit: Obstacles Found in Cutter Station + manage-machine

## Issues Identified (Priority Order)

### CRITICAL: `completedAtRunStart` is `null` during active runs
**Console logs confirm this**: multiple RPC calls show `"completedAtRunStart": null`. When null, `effectiveCompleted` (line 224-228) falls back to the raw DB value, which means the slot tracker's `totalCutsDone` is **ignored** during the run. The piece counter can show stale data or jump unpredictably.

**Root cause**: State restoration on line 82-89 fetches `completed_pieces` async, but if the machine isn't in a restored state (fresh start), `completedAtRunStart` stays null until `handleLockAndStart` sets it. However, between `setIsRunning(true)` (line 271) and the async DB fetch completing (line 278-279), there's a window where strokes can fire with null snapshot.

**Fix**: Guard `handleRecordStroke` — block strokes until `completedAtRunStart` is set.

### HIGH: `supervisorUnlock.ts` uses `"cancelled"` vs `"canceled"` everywhere else
Line 16 writes `"cancelled"` (British). `startRun.ts` and `startQueuedRun.ts` write `"canceled"` (American). Any queries filtering by `status = 'canceled'` will miss supervisor-unlocked runs, breaking reports and stale-run detection.

**Fix**: Change `"cancelled"` → `"canceled"` in `supervisorUnlock.ts`.

### HIGH: `handleCompleteRun` has stale closure references
Line 592 dependency array: `[currentItem, slotTracker, selectedStockLength, machine, toast, completedPieces, totalPieces, currentIndex, items.length, completedAtRunStart]`

Missing: `barsForThisRun`, `computedPiecesPerBar`, `queryClient`, `items` (only `items.length` is listed, but `items[nextIdx]` is accessed on line 581).

**Fix**: Add missing deps or extract stable refs.

### MEDIUM: Stroke RPC has no retry on failure
Line 392-402: `increment_completed_pieces` fires and logs errors but doesn't retry. A transient network glitch silently loses piece counts. The operator sees a success toast but the DB never incremented.

**Fix**: Add a single retry with 1s delay on failure, and queue failed increments for batch retry.

### MEDIUM: Remnant prompt fires mid-run blocking UI
Line 414-428: When the last stroke completes all slots, the remnant dialog opens immediately — before `handleCompleteRun`. The dialog blocks dismissal (line 899). If the operator needs to do anything else first, they're stuck.

**Fix**: Defer remnant prompt to `handleCompleteRun` flow instead of triggering it inside `handleRecordStroke`.

### LOW: 1006-line monolith component
`CutterStationView.tsx` manages 15+ state variables, 6+ handlers, and renders the full station UI. This makes every change risky and debugging slow.

**Fix** (future): Extract `useRunState` hook, `RunControlPanel` component, and `RemnantPrompt` component.

---

## Plan: Fix the 5 actionable issues

### File 1: `supabase/functions/manage-machine/handlers/supervisorUnlock.ts`
- Line 16: `"cancelled"` → `"canceled"`

### File 2: `src/components/shopfloor/CutterStationView.tsx`
- **Guard strokes**: In `handleRecordStroke`, add early return if `completedAtRunStart === null` with a warning toast
- **Fix stale closure**: Add missing deps to `handleCompleteRun` useCallback
- **Defer remnant prompt**: Move the remnant check from `handleRecordStroke` to `handleCompleteRun`, removing the mid-stroke dialog block
- **Add stroke retry**: Wrap the RPC call with a single retry on failure

