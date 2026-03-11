

## Fix: "Jumping to Others" in Bender Station

### Root Cause
Two issues cause the bender station view to "jump" to a different item during realtime updates:

1. **BenderStationView has no ID-based item tracking.** It uses `currentIndex` (a number) to track the selected item, but when the `items` array changes (item completes and leaves, or re-orders), the same index now points to a different item. CutterStationView already solved this with `trackedItemId` — BenderStationView never got this fix.

2. **Bender query has no stable ordering.** The cutter query uses `.order("id", { ascending: true })` but the bender query (line 64 of `useStationData.ts`) has no `.order()` clause, so PostgreSQL can return rows in different order between re-fetches.

3. **StationView auto-clear effect uses `filteredItems`.** The effect at lines 122-126 clears `selectedItemId` if the item isn't in `filteredItems` (barlist-filtered), which can briefly mismatch during data refresh, kicking the user back to the grid view.

### Changes

**1. `src/hooks/useStationData.ts`** — Add stable ordering to bender query
- Add `.order("id", { ascending: true })` to the bender query (after line 64)

**2. `src/components/shopfloor/BenderStationView.tsx`** — Add ID-based tracking (same pattern as CutterStationView)
- Add `trackedItemId` state
- Replace the simple bounds-clamp effect with an ID-based reconciliation effect that finds the tracked item's new index after data refresh
- Set `trackedItemId` when navigating between items

**3. `src/pages/StationView.tsx`** — Fix auto-clear to use `items` instead of `filteredItems`
- Change line 123 from `filteredItems.some(...)` to `items.some(...)` so the detail view isn't dismissed when the barlist filter temporarily excludes the item

### Summary
These three changes ensure: (a) bender items maintain stable order across re-fetches, (b) the active item is tracked by ID not index, and (c) the detail view isn't kicked back to grid during realtime refreshes.

