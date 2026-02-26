

## Root Cause Analysis

I traced the full flow and found **two bugs** causing the "repeat" behavior after completing a run:

### Bug 1: Completion doesn't persist pieces (primary cause)

In `handleCompleteRun` (line 382-386 of `CutterStationView.tsx`), the final database call sends `p_increment: 0`:

```typescript
await supabase.rpc("increment_completed_pieces", {
  p_item_id: currentItem.id,
  p_increment: 0, // ← PROBLEM: trusts strokes already persisted
});
```

Stroke-level persistence (line 298-305) is **fire-and-forget** — if it fails silently (network blip, timeout), the DB keeps `completed_pieces = 0`. The completion call with `p_increment: 0` doesn't fix it. Result: phase never advances, item reappears after realtime refresh, operator thinks it "reset".

**Evidence**: Mark B1001 (1 piece needed) was run **4 times** across 2 items — operator had to retry because the item kept reappearing.

**Fix**: Change `p_increment` from `0` to `totalOutput`. The RPC uses `LEAST(completed + increment, total)`, so even if strokes DID persist, it safely caps — no double-counting risk.

### Bug 2: LOCK & START not disabled for completed items

The CutEngine's `canStart` logic never checks if the item is already done:
```typescript
const canStart = canWrite && !isRunning && (isFeasible || ...);
// ← missing: && !isDone
```

So even when the left panel shows "This mark is complete", the right panel still allows starting a new run.

**Fix**: Pass `isDone` to CutEngine and add it to the `canStart` guard.

---

## Implementation Plan

### `src/components/shopfloor/CutterStationView.tsx`

1. **Line 385**: Change `p_increment: 0` to `p_increment: totalOutput` — ensures completion always persists the full count even if stroke-level calls failed

2. **Line 696-701 area**: Pass `isDone` prop to `CutEngine`

### `src/components/shopfloor/CutEngine.tsx`

3. Add `isDone` prop and include it in `canStart`:
```typescript
const canStart = canWrite && !isRunning && !isDone && (isFeasible || ...);
```

4. When `isDone`, show a "DONE" label on the button instead of "LOCK & START"

