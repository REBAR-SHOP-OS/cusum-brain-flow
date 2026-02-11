

## Fix: Cutter Queue "Reset to 0" Race Condition

### Root Cause (confirmed)
Line 130 in `CutterStationView.tsx`:
```
setCompletedAtRunStart(completedPieces);
```
`completedPieces` derives from `currentItem?.completed_pieces` (line 89), which may be stale if the realtime subscription hasn't delivered the latest DB value yet. This causes the snapshot to capture 0 (or an old value), making the next run's progress calculation start from the wrong base.

### Fix (single surgical change)

**File: `src/components/shopfloor/CutterStationView.tsx`**

Replace line 130 with a direct DB fetch before snapshotting:

```typescript
// Line 125-131 becomes:
const handleLockAndStart = async (stockLength: number, bars: number) => {
  if (!currentItem) return;
  try {
    setIsRunning(true);
    // Fetch fresh completed_pieces from DB to avoid stale realtime data
    const { data: freshRow } = await supabase
      .from("cut_plan_items")
      .select("completed_pieces")
      .eq("id", currentItem.id)
      .single();
    const freshCompleted = freshRow?.completed_pieces ?? completedPieces;
    setCompletedAtRunStart(freshCompleted);
    // ... rest unchanged
```

This ensures the snapshot always reflects the true DB state, regardless of whether the realtime subscription has delivered the update yet. The DB fetch adds ~50ms latency (negligible since the operator just clicked a button).

### What This Does NOT Change
- No changes to `useStationData.ts`, `ProductionCard.tsx`, `handleCompleteRun`, `handleRecordStroke`, or any other file
- No schema changes, no new queries, no UI changes
- The auto-advance behavior (item disappearing after completion) remains correct
- The `completedAtRunStart` reset to `null` on line 322 remains correct

### Files Modified
- `src/components/shopfloor/CutterStationView.tsx` — lines 128-130 only (add DB fetch before snapshot)

