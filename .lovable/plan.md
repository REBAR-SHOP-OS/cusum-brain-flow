
# Fix: "Pieces Cut" Counter Stays at 0 on Shopfloor Station Page

## Root Cause

The bug has two connected parts, both in `src/components/shopfloor/CutterStationView.tsx`.

### Part 1 — Missing guard on `effectiveCompleted` when machine was already running on mount

The "Pieces Done" stat card (line 507) shows `effectiveCompleted`, computed as:

```ts
const effectiveCompleted = completedAtRunStart != null
  ? completedAtRunStart + slotTracker.totalCutsDone
  : completedPieces;   // ← fallback when completedAtRunStart is null
```

`completedAtRunStart` is only set when the operator clicks **LOCK & START** in the current browser session (line 147). If the machine is already in `running` status in the database when the page loads, then:
- `machineIsRunning` = `true` (because `machine.status === "running"`)
- `isRunning` = `false` (local state, not yet started)
- `completedAtRunStart` = `null`
- The SlotTracker also has no slots (`slots.length === 0`)

So `effectiveCompleted` falls back to `completedPieces` from the database, which only refreshes on the background polling interval (every ~10s), not in real-time after strokes.

### Part 2 — Stale `totalCutsDone` read immediately after `recordStroke()`

In `handleRecordStroke` (line 220):

```ts
slotTracker.recordStroke();                                        // setState — async
const newCutsDone = slotTracker.totalCutsDone + activeBars;       // ← reads OLD stale value
```

`recordStroke()` updates React state asynchronously. The line immediately after still reads the pre-stroke `totalCutsDone`. This causes the DB persist (line 224) to write an incorrect accumulated total — it adds `activeBars` to the stale value instead of the true new total.

**Concrete example:**
- After stroke 1: `slotTracker.totalCutsDone` = 0 (stale), `activeBars` = 3 → writes `completedAtRunStart + 3`
- After stroke 2: `slotTracker.totalCutsDone` = 3 (now updated), `activeBars` = 3 → writes `completedAtRunStart + 6` ✓

So the DB write is off by exactly one stroke cycle. The display recovers on the next render. But if `completedAtRunStart` is `null`, nothing displays correctly at all.

## The Fix

**File:** `src/components/shopfloor/CutterStationView.tsx`  
**Two targeted changes only:**

---

### Fix 1 — Correct the stale read in `handleRecordStroke`

Instead of reading `slotTracker.totalCutsDone` after `recordStroke()` (stale), compute the new total **before** calling `recordStroke()` and use that:

**Before (lines 215–235):**
```ts
const handleRecordStroke = useCallback(() => {
  const activeBars = slotTracker.slots.filter(s => s.status === "active").length;
  slotTracker.recordStroke();

  const newCutsDone = slotTracker.totalCutsDone + activeBars;   // ← stale

  if (currentItem && completedAtRunStart !== null) {
    const newCompleted = Math.min(completedAtRunStart + newCutsDone, totalPieces);
    ...
  }
  ...
}, [...]);
```

**After:**
```ts
const handleRecordStroke = useCallback(() => {
  const activeBars = slotTracker.slots.filter(s => s.status === "active").length;
  const newCutsDone = slotTracker.totalCutsDone + activeBars;   // ← computed BEFORE recordStroke

  slotTracker.recordStroke();

  if (currentItem && completedAtRunStart !== null) {
    const newCompleted = Math.min(completedAtRunStart + newCutsDone, totalPieces);
    ...
  }
  ...
}, [...]);
```

This is a **2-line reorder** — move `newCutsDone` before `recordStroke()`.

---

### Fix 2 — Guard `effectiveCompleted` when slots exist but `completedAtRunStart` is null

When the slot tracker has active slots (meaning a run is in progress), but `completedAtRunStart` is null (e.g., page was refreshed mid-run), fall back to `completedPieces + slotTracker.totalCutsDone` instead of just `completedPieces`:

**Before (lines 97–99):**
```ts
const effectiveCompleted = completedAtRunStart != null
  ? completedAtRunStart + slotTracker.totalCutsDone
  : completedPieces;
```

**After:**
```ts
const effectiveCompleted = completedAtRunStart != null
  ? completedAtRunStart + slotTracker.totalCutsDone
  : slotTracker.slots.length > 0
    ? completedPieces + slotTracker.totalCutsDone   // running but no snapshot → use DB base + local progress
    : completedPieces;
```

This ensures that even if the operator's session was interrupted and they resumed, the counter still increments correctly as they record strokes.

---

## Scope

| File | Lines Changed | Type |
|------|--------------|------|
| `src/components/shopfloor/CutterStationView.tsx` | ~97–99 (3 lines) | effectiveCompleted fallback |
| `src/components/shopfloor/CutterStationView.tsx` | ~217–220 (2 lines reorder) | newCutsDone before recordStroke |

**Total: 1 file, 2 micro-changes. No other files, components, database, or UI elements are touched.**

## What Is NOT Changed

- `SlotTracker.tsx` — untouched
- `useSlotTracker.ts` — untouched
- `CutEngine.tsx` — untouched
- Database schema — untouched
- All other pages — untouched
- All other stat cards (Pcs/Bar, Bars Needed, This Run) — untouched
- The SlotTracker component's own display — untouched (already correct)
