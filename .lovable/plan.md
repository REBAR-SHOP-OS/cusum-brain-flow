

## Fix: Make ALL Cutter Numbers Rock-Solid and Foolproof

### The Problem

During an active run, `completedPieces` (from `currentItem.completed_pieces`) gets updated by realtime subscription every time a stroke is saved to the DB. This causes ALL derived numbers to flicker and jump because they're mixing "realtime-updated base" with "local slot tracker progress":

- **Bars Needed** flickers down as realtime catches up, then re-calculates wrong
- **This Run** changes mid-run because it depends on Bars Needed
- **isDone** can flash `true` prematurely when realtime delivers a mid-run update
- **Pieces Done** already fixed but other cards still use raw `completedPieces`

### The Fix: One Single Source of Truth

Create ONE variable `effectiveCompleted` that ALL display numbers derive from:

```
When run is active (completedAtRunStart is set):
  effectiveCompleted = completedAtRunStart + slotTracker.totalCutsDone

When idle (no run):
  effectiveCompleted = completedPieces (from realtime/DB)
```

Then derive EVERYTHING from `effectiveCompleted`:

| Card | Current Source | Fixed Source |
|------|---------------|-------------|
| Bars Needed | `remainingPieces` (uses raw `completedPieces`) | `totalPieces - effectiveCompleted` |
| This Run | `barsStillNeeded` (uses raw `completedPieces`) | derived from fixed remaining |
| Pieces Done | already using `completedAtRunStart` | uses `effectiveCompleted` (cleaner) |
| isDone | `remainingPieces <= 0` (uses raw) | `effectiveRemaining <= 0` |
| "mark complete" banner | uses `isDone` | automatically fixed |

### Changes (single file)

**File: `src/components/shopfloor/CutterStationView.tsx`**

Replace lines 88-95 (the derived values block) with:

```typescript
const computedPiecesPerBar = runPlan?.piecesPerBar || 
  (currentItem ? Math.floor(selectedStockLength / currentItem.cut_length_mm) : 1);
const totalPieces = currentItem?.total_pieces || 0;
const completedPieces = currentItem?.completed_pieces || 0;

// SINGLE SOURCE OF TRUTH: during a run, use snapshot + local tracker;
// when idle, use whatever the DB/realtime says
const effectiveCompleted = completedAtRunStart != null
  ? completedAtRunStart + slotTracker.totalCutsDone
  : completedPieces;

const remainingPieces = totalPieces - effectiveCompleted;
const barsStillNeeded = computedPiecesPerBar > 0 
  ? Math.ceil(remainingPieces / computedPiecesPerBar) : 0;
const barsForThisRun = operatorBars ?? runPlan?.barsThisRun ?? barsStillNeeded;
const isDone = remainingPieces <= 0;
```

Then simplify the "Pieces Done" display (line 468-470) to just use `effectiveCompleted`:

```tsx
<p className="text-3xl font-black font-mono text-foreground">
  {effectiveCompleted}
  <span className="text-lg text-muted-foreground">/{totalPieces}</span>
</p>
```

### What This Guarantees

- During a run: numbers ONLY change when the operator presses CUT (local state update) -- never from delayed realtime events
- When idle: numbers reflect the latest DB value via realtime as before
- No flicker, no double-counting, no premature "done" state
- Zero risk of stale data causing wrong calculations

### Files Modified
- `src/components/shopfloor/CutterStationView.tsx` only -- lines 88-95 (derived values) and lines 468-470 (display simplification)

