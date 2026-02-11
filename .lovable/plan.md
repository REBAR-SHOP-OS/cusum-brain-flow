
## Cutter and Bender Bug Audit — 4 Issues Found

### Bug 1: `handleCompleteRun` has stale `completedAtRunStart` (CRITICAL)
**Location**: `CutterStationView.tsx` line 356

`completedAtRunStart` is NOT in the `useCallback` dependency array of `handleCompleteRun`. This means when `handleLockAndStart` sets `completedAtRunStart` to the fresh DB value, `handleCompleteRun` still holds the OLD value (null) from the previous render — because none of its listed deps changed at the same time.

Line 291 then does: `const baseCompleted = completedAtRunStart ?? completedPieces` — with stale `completedAtRunStart = null`, it falls back to `completedPieces` which may also be stale. This can cause the final DB write to save the wrong `completed_pieces`.

**Fix**: Add `completedAtRunStart` to the deps array on line 356.

---

### Bug 2: Bender DONE button doesn't refresh data (CRITICAL)
**Location**: `BenderStationView.tsx` line 104

After pressing DONE, the query is invalidated with:
```
queryClient.invalidateQueries({ queryKey: ["station-data", machine.id] })
```

But `useStationData` uses a THREE-part key: `["station-data", machineId, machineType]` (line 58 of useStationData.ts). The two-part key doesn't match, so the invalidation silently fails and the bender UI doesn't refresh after DONE. The operator sees stale counts until the realtime subscription happens to fire.

**Fix**: Change to `["station-data", machine.id, "bender"]` on line 104.

---

### Bug 3: "Pieces Done" display double-counts after realtime update (DISPLAY)
**Location**: `CutterStationView.tsx` line 464

The display shows:
```
{completedPieces + slotTracker.totalCutsDone}
```

After each stroke, `handleRecordStroke` saves `completedAtRunStart + totalCutsDone` to DB. When realtime delivers the update, `completedPieces` becomes `completedAtRunStart + totalCutsDone`. The display then shows `(completedAtRunStart + totalCutsDone) + totalCutsDone` — double-counting the current run's cuts.

The flicker is: correct value right after stroke, then jumps to double when realtime arrives.

**Fix**: During an active run (when `completedAtRunStart` is not null), use `completedAtRunStart + slotTracker.totalCutsDone` instead of `completedPieces + slotTracker.totalCutsDone`. Fallback to `completedPieces` when no run is active.

---

### Bug 4: Indentation misalignment from last edit (MINOR)
**Location**: `CutterStationView.tsx` line 128

`setIsRunning(true)` lost its indentation in the previous diff. Cosmetic but should be corrected.

---

### Summary of Changes

| File | Line(s) | Fix |
|------|---------|-----|
| `CutterStationView.tsx` | 128 | Fix indentation of `setIsRunning(true)` |
| `CutterStationView.tsx` | 356 | Add `completedAtRunStart` to `handleCompleteRun` deps |
| `CutterStationView.tsx` | 464 | Use `completedAtRunStart` for display during active run |
| `BenderStationView.tsx` | 104 | Fix query key to include `"bender"` for proper invalidation |

All fixes are surgical single-line changes. No schema changes, no new files, no UI redesign.
