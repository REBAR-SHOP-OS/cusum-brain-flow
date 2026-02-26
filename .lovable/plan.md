

## Problem

After completing the last mark's run, the view loops back to showing a fresh "LOCK & START" state for the same mark instead of finishing. This happens because:

1. `handleCompleteRun` resets local state (`isRunning = false`, `slotTracker.reset()`, `completedAtRunStart = null`)
2. The component re-renders before the DB has propagated the final `completed_pieces` value
3. `effectiveCompleted` falls back to the stale `completedPieces` from the previous query cache, showing remaining pieces > 0
4. The foreman brain generates a new run plan, presenting "LOCK & START" again
5. When realtime finally updates, `isDone` briefly becomes true, then the phase advances and the item disappears — but the cycle may repeat

Additionally, when the last mark IS complete and it's the only/last item, the message says "move to next item" but there is no next item — the view should show an "All Done" state instead.

## Fix

### `src/components/shopfloor/CutterStationView.tsx`

1. **Add a `justCompleted` guard state**: After `handleCompleteRun`, set a flag like `justCompletedItemId` to the current item's ID. While this flag matches `currentItem.id`, suppress the run UI (CutEngine, ForemanPanel, SlotTracker) and show a "Completing..." / "Done" state instead of the run controls. This prevents the loop.

2. **Clear the guard** when the item actually disappears from the `items` list (realtime removes it) or when switching to a different item.

3. **Fix the "last mark complete" message**: When `isDone && !machineIsRunning` and `remaining === 0` (no more marks), show "All marks complete — this machine is done" instead of "move to next item". Include a button to go back to the station dashboard.

4. **Immediately set `effectiveCompleted` to `totalPieces`** after `handleCompleteRun` for the current item to prevent the stale-data window. Store a local `localCompletedOverride` map that holds `{ itemId: completedCount }` set during `handleCompleteRun`, used in `effectiveCompleted` calculation. Cleared when the item leaves the list.

### Technical Detail

```text
handleCompleteRun:
  1. DB calls (increment_completed_pieces, manageMachine, etc.)
  2. Set justCompletedItemId = currentItem.id
  3. Set localCompletedOverride = totalPieces
  4. Reset slot tracker, isRunning, etc.

Render logic:
  if (justCompletedItemId === currentItem.id):
    → Show "Mark complete" card (not run controls)
    → If remaining === 0: "All marks done" + Back button
    → If remaining > 0: auto-advance after 1.2s (existing logic)

  Clear justCompletedItemId when:
    → currentItem.id changes (item removed/advanced)
    → items list no longer contains justCompletedItemId
```

