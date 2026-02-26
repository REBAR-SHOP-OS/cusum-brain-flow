

## Audit Results — Cutter Station Bugs

### Bug 1 (Critical): Partial run completion freezes UI with "Mark complete — advancing" forever

In `handleCompleteRun` (line 384), `justCompletedItemId` is always set. But the auto-advance timeout (line 410-414) only fires when `isMarkComplete` is true. For partial runs (mark NOT done), the guard card at line 491 activates and never clears — the operator sees "Mark complete — advancing to next item…" permanently, with no way to continue cutting.

**Fix**: Only set `justCompletedItemId` when `isMarkComplete`. For partial runs, skip the guard entirely — just reset run state and let the foreman regenerate a plan for the remaining pieces.

### Bug 2 (Critical): `effectiveCompleted` reverts to stale DB value after partial run

`localCompletedOverride` is only set when `isMarkComplete` (line 385-387). After a partial run completes:
- `completedAtRunStart` is cleared (line 394)
- `slotTracker` is reset (line 389)
- `effectiveCompleted` falls back to stale `completedPieces` from DB
- Until realtime propagates, the UI briefly shows the old count, `barsStillNeeded` spikes back up, and `suggestedBars` jumps — causing CutEngine's bar count to reset incorrectly

**Fix**: Always set `localCompletedOverride` to `newCompletedPieces` after any run (not just complete marks). Clear it when item refreshes via realtime (detected by `completedPieces` changing).

### Bug 3 (Medium): Auto-advance clears guard before item leaves list

Line 412: `setJustCompletedItemId(null)` fires after 1200ms. If realtime hasn't removed the item yet, the guard drops and the stale foreman re-generates a run plan, briefly showing "LOCK & START" before the item disappears. This is the original loop bug partially resurfacing.

**Fix**: Don't clear `justCompletedItemId` in the timeout — only advance the index. Let the `useEffect` at line 55-66 handle clearing when the item actually leaves the list.

### Bug 4 (Minor): `remaining` marks count uses stale DB data

Line 87: `remaining = items.filter(i => i.completed_pieces < i.total_pieces).length` uses raw DB values. During/after a run, the "4 MARKS REMAINING" strip doesn't update until realtime propagates, even though the pieces counter already shows completion.

**Fix**: Account for `localCompletedOverride` when computing `remaining` — if an item has an override >= total_pieces, exclude it from the remaining count.

---

### Changes

**`src/components/shopfloor/CutterStationView.tsx`**:

1. Only set `justCompletedItemId` when `isMarkComplete` (removes partial-run freeze)
2. Always set `localCompletedOverride` to `newCompletedPieces` after any run completion
3. Add a `useEffect` to clear `localCompletedOverride` entries when the DB value catches up (i.e., `completedPieces` changes to match or exceed the override)
4. Remove `setJustCompletedItemId(null)` from the auto-advance timeout — let the item-removal effect handle it
5. Compute `remaining` accounting for `localCompletedOverride`

