
## Enhance Pickup Station Bundle Detail View

### Problem
When a user taps a bundle on the `/shopfloor/pickup` page, the detail view shows plain item cards with only text and a bar code badge. It's missing:
1. Selection checkmarks for each item
2. Product/loading photos (from loading checklist evidence)
3. A "Create Pickup Packing Slip" button

### Solution
Upgrade the selected bundle detail view in `src/pages/PickupStation.tsx` to include item-level checkboxes, loading evidence photos, and a packing slip generation button.

### Technical Details

**File: `src/pages/PickupStation.tsx`**

1. **Add imports**: `Checkbox`, `useLoadingChecklist`, `DeliveryPackingSlip`, `useState` for checked state and packing slip visibility, plus `supabase` for signed photo URLs.

2. **Replace the selected bundle detail view** (lines 34-62) with an enhanced version:
   - Add `useLoadingChecklist(selectedBundle.cutPlanId)` to fetch loading evidence (photos)
   - Add local state: `checkedItems` (Set of item IDs), `showPackingSlip` (boolean)
   - For each item card:
     - Add a `Checkbox` on the left side that toggles item selection
     - Show loading photo thumbnail (from `checklistMap`) if `photo_path` exists -- resolve via `supabase.storage.from("clearance-photos").createSignedUrl()`
   - Add a "Select All / Deselect All" toggle in the header
   - Add a "Create Pickup Packing Slip" button at the bottom (enabled when at least one item is checked)
   - When clicked, render the existing `DeliveryPackingSlip` component with the selected items, using the bundle's project name as customer and a generated slip number

3. **Photo resolution**: Use a `useEffect` to pre-resolve signed URLs for all items that have `photo_path` in the loading checklist, storing them in a `Map<string, string>` state.

### UI Layout (per item card)
```text
[Checkbox] [Photo thumbnail (40x40)] Mark: 001 | 3040mm | 6 pcs     [10M badge]
```

### Button placement
A sticky footer bar with:
- Item count summary: "3 of 5 selected"
- "Create Pickup Packing Slip" button (primary, disabled when none selected)
