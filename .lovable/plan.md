

# Fix: Complete Run Should Return to Pool

## Problem
After clicking "Complete Run" → remnant dialog → "Save/Discard", the run completes (backend updated, toast shown) but the UI stays on the item view. The operator expects to return to the pool (item list).

## Root Cause
`handleCompleteRun` resets local state (`isRunning`, `completedLocally`, etc.) but never calls `onBack?.()` to navigate back to the pool view. The `onBack` prop is wired to `setSelectedItemId(null)` in `StationView.tsx`, which shows the pool.

## Fix — `CutterStationView.tsx`

After the completion toast (lines 563-574), add a delayed `onBack?.()` call so the operator returns to pool after seeing the toast:

```typescript
// After the routing toast block (line 574), add:
setTimeout(() => {
  onBack?.();
}, 1500);
```

Remove the existing auto-advance logic (lines 576-589) since the user always wants to return to pool after completion. Or keep it but ensure `onBack` is the default behavior when mark is NOT complete or there are no more items.

Actually, the cleaner approach: **always call `onBack`** after completion with a short delay, regardless of mark completion status. The pool view will reflect the updated state (completed marks removed from queue).

### Specific change (line 574, after the toast block):

Add after line 574:
```typescript
// ── Return to pool after completion ──
setTimeout(() => {
  onBack?.();
}, 1500);
```

And remove or guard the auto-advance block (lines 576-589) so it doesn't conflict.

**One file changed:** `src/components/shopfloor/CutterStationView.tsx`

