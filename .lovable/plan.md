

# Fix: Clicking Production Card Opens Wrong Item

## Root Cause

When a user clicks a card (e.g., T1001), `CutterStationView` mounts with `initialIndex` pointing to T1001. However, a `useEffect` on lines 70-130 checks if the machine has an active locked job (`machine.active_job_id`). If the machine is currently running AS35, line 128 executes `setCurrentIndex(lockedIndex)`, overriding the user's selection to show AS35 instead.

This "restore from backend" logic is designed for page-refresh recovery but fires unconditionally on every mount — including when the user explicitly clicks a specific card.

## Fix

**File**: `src/components/shopfloor/CutterStationView.tsx`

The restore logic should only override `currentIndex` when the user navigated to the station view **without** selecting a specific item (i.e., `initialIndex === 0` as the default). When the user explicitly clicked a card, `initialIndex` will be non-zero (or more precisely, it will match the clicked item's index).

Better approach: Pass a flag or use the `initialIndex` to determine intent:

- Add a prop `userSelectedItem?: boolean` to `CutterStationView` (and `BenderStationView`)
- In `StationView.tsx`, pass `userSelectedItem={true}` when `selectedItemId` is set
- In the restore `useEffect`, skip the `setCurrentIndex(lockedIndex)` override when `userSelectedItem` is true — the user explicitly chose which item to view

**Same fix needed in `BenderStationView`** (line 38, same pattern).

### Changes

| File | Change |
|------|--------|
| `src/components/shopfloor/CutterStationView.tsx` | Add `userSelectedItem` prop; skip restore override when true |
| `src/components/shopfloor/BenderStationView.tsx` | Add `userSelectedItem` prop; skip restore override when true |
| `src/pages/StationView.tsx` | Pass `userSelectedItem={true}` when rendering from card click |

### Safety
- Refresh recovery still works (no explicit card selection → `userSelectedItem` defaults to false)
- Explicit card click always shows the correct item
- No changes to data flow or array ordering

