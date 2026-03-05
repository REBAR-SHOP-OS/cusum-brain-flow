

# Fix: Double-Counting in `completed_pieces` (Pieces Done Mismatch)

## Problem
The "Pieces Done" counter (54/120) is inflated because `completed_pieces` gets incremented **twice** for each run:
1. **Per-stroke** (line 300-309): Each stroke calls `increment_completed_pieces` with `activeBars` — correctly persisting progress incrementally.
2. **On complete** (line 386-390): Calls `increment_completed_pieces` with the **full** `totalOutput` again, instead of just the delta between what was already persisted and the actual output.

Since strokes already persisted all pieces, the "Complete Run" call adds the entire run output a second time. The `LEAST(completed + increment, total)` cap prevents going over `total_pieces`, but across multiple runs the over-counting accumulates, producing values like 54 when only 36 pieces (2 × 18) should be recorded.

## Fix

**File: `src/components/shopfloor/CutterStationView.tsx`** (line ~381-390)

Change the final `increment_completed_pieces` call in `handleCompleteRun` to be a **reconciliation** rather than a full re-increment. Calculate what was already persisted (number of strokes × pieces-per-stroke) and only send the difference:

```typescript
// Calculate what was already persisted stroke-by-stroke
const alreadyPersisted = slotTracker.slots.reduce((sum, s) => sum + s.cutsDone, 0);
const reconciliationDelta = Math.max(0, totalOutput - alreadyPersisted);

if (reconciliationDelta > 0) {
  const { error: itemErr } = await supabase
    .rpc("increment_completed_pieces", {
      p_item_id: currentItem.id,
      p_increment: reconciliationDelta,
    });
  if (itemErr) throw itemErr;
}
```

Wait — `totalOutput` IS `slotTracker.totalCutsDone` (line 375), and `alreadyPersisted` would equal the same thing since each stroke increments by the same amount it reports. So `reconciliationDelta` would always be 0.

This means the entire final `increment_completed_pieces` call in `handleCompleteRun` is redundant and should be **removed entirely** — strokes already fully persist the count.

### Actual change:
Remove lines 381-391 (the final `increment_completed_pieces` RPC call in `handleCompleteRun`). The stroke-by-stroke persistence at line 300-309 already handles all counting.

**Additionally**: Fix the existing inflated data by running a data correction query that recalculates `completed_pieces` from actual completed run outputs (this would be a one-time data fix via the insert tool).

## Summary
- **`src/components/shopfloor/CutterStationView.tsx`**: Remove the redundant `increment_completed_pieces` call inside `handleCompleteRun` — strokes already persist the full count.
- **Database**: One-time data correction to fix inflated `completed_pieces` values.

