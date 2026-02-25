

## Fix: Bender Shows "No Items" After Completing a Bend

### Root Cause

When a bend completes (`bend_completed_pieces >= total_pieces`), a database trigger changes the item's phase from `"bending"` to `"clearance"`. The bender query only fetches items with `phase = cut_done` or `phase = bending`, so the completed item disappears from the `items` array after the next refetch.

The `BenderStationView` keeps `currentIndex` unchanged. If the completed item was the last (or only) item, `items[currentIndex]` becomes `undefined` → `currentItem = null` → "No items queued to this bender" is shown, even though other items (like B1503) still exist in the list or should be navigated back to.

### Solution

**File: `src/components/shopfloor/BenderStationView.tsx`**

Add a `useEffect` that watches `items.length` and `currentIndex` to keep the index in bounds:

```typescript
// Keep currentIndex in bounds when items change (e.g. completed item removed)
useEffect(() => {
  if (items.length > 0 && currentIndex >= items.length) {
    setCurrentIndex(items.length - 1);
  }
}, [items.length, currentIndex]);
```

This ensures:
- If the completed item is removed and there are remaining items → index resets to last valid item
- If ALL items are done → `items.length === 0` → the existing `!currentItem` empty state shows correctly, but now the `onBack` button is available to return to the pool view

**File: `src/pages/StationView.tsx`**

After the last bend item completes and `items` becomes empty in the bender context, auto-clear `selectedItemId` so the user returns to the item list (not stuck in BenderStationView):

Add logic in the effect that watches `filteredItems`: if `selectedItemId` is set but the selected item no longer exists in `filteredItems`, clear it to go back to the grid/list view.

```typescript
useEffect(() => {
  if (selectedItemId && filteredItems.length > 0 
      && !filteredItems.some(i => i.id === selectedItemId)) {
    setSelectedItemId(null);
  }
}, [filteredItems, selectedItemId]);
```

### Technical Details
- Two small `useEffect` additions — no database or edge function changes
- The DB trigger `auto_advance_item_phase` correctly moves completed bends to `"clearance"` — this is expected behavior
- The bender query correctly excludes `"clearance"` items — no change needed there
- Fix is purely about keeping the UI index/state in sync when items disappear from the filtered list

