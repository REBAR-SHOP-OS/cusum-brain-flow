

# Cutter Counter Over-Count — Root Cause Analysis & Fix

## Architecture Summary (What I Found)

The counting pipeline has **one writer path** and **no duplication bug in normal operation**:

1. **Stroke recording** (`handleRecordStroke` in CutterStationView.tsx, line 330): Each tap calls `increment_completed_pieces` RPC with `p_increment = activeBars` (number of bars being cut simultaneously).
2. **RPC function** (SQL): `SET completed_pieces = LEAST(completed_pieces + p_increment, total_pieces)` — atomic, capped at total.
3. **Complete run** (`handleCompleteRun`, line 414): Comment at line 424 explicitly says "No final increment needed here — doing so would double-count." ✓ Correct.
4. **manage-machine edge function**: Does NOT touch `completed_pieces`. ✓ Correct.
5. **DB trigger**: Only advances `phase` when `completed_pieces >= total_pieces`. Does NOT modify the counter. ✓ Correct.

## The Real Bug: `effectiveCompleted` Calculation (Line 176-182)

```typescript
const effectiveCompleted = currentItem && localCompletedOverride[currentItem.id] != null
  ? localCompletedOverride[currentItem.id]
  : completedAtRunStart != null
    ? completedAtRunStart + slotTracker.totalCutsDone  // ← DISPLAY PATH A
    : slotTracker.slots.length > 0
      ? completedPieces + slotTracker.totalCutsDone    // ← DISPLAY PATH B (BUG)
      : completedPieces;
```

**Path B** is the problem: If `completedAtRunStart` is null but slots exist (race condition during startup), it computes `completedPieces + totalCutsDone`. But `completedPieces` comes from DB (already incremented by the RPC), and `totalCutsDone` counts the same strokes locally. **This shows double the actual count on the UI**, which the operator interprets as over-counting.

However, the **database value is correct** — the bug is a **display-only** issue that makes operators think extra pieces were counted.

## Second Risk: vizzy-erp-action Absolute Write

The `vizzy-erp-action` edge function (line 105) allows the AI assistant to do **absolute writes** to `completed_pieces`:
```typescript
if (updates.completed_pieces !== undefined) safeUpdates.completed_pieces = updates.completed_pieces;
```
If Vizzy (the AI) ever sets this to a wrong value, it overwrites the atomic counter. This is a potential source of "random" over-counting that has no pattern.

## Fix Plan

### 1. Eliminate Display Path B (CutterStationView.tsx, line 176-182)
Remove the fallback that adds `slotTracker.totalCutsDone` to the live DB value. If `completedAtRunStart` is null, we should NOT add local cuts to the DB value (which already includes them).

```typescript
const effectiveCompleted = currentItem && localCompletedOverride[currentItem.id] != null
  ? localCompletedOverride[currentItem.id]
  : completedAtRunStart != null
    ? completedAtRunStart + slotTracker.totalCutsDone
    : completedPieces;  // ← Remove the double-add path
```

### 2. Guard vizzy-erp-action Against Absolute Writes (vizzy-erp-action/index.ts)
Change the `update_cut_plan_item` action to use the atomic RPC instead of absolute writes for `completed_pieces`:

```typescript
// Remove: if (updates.completed_pieces !== undefined) safeUpdates.completed_pieces = updates.completed_pieces;
// The AI should not be allowed to set completed_pieces directly
```

## Files to Edit
- `src/components/shopfloor/CutterStationView.tsx` — fix effectiveCompleted calculation (line 176-182)
- `supabase/functions/vizzy-erp-action/index.ts` — remove absolute write path for completed_pieces (line 105)

