

## Enable Edit Functionality in Detailed List

### Problem
The pencil (edit) icon button on each row in the Detailed List view has no `onClick` handler — it's purely decorative. Users cannot edit item fields.

### Solution
Add inline row editing. When the pencil is clicked, that row switches to edit mode with input fields for editable columns. A save/cancel button pair replaces the pencil. On save, update the row in `cut_plan_items` via Supabase.

### Editable Fields
- **Mark Number** (mark_number)
- **Qty** (total_pieces)
- **Cut Length** (cut_length_mm)
- **Bend Type / ASA Shape Code** (bend_type, asa_shape_code)
- **Drawing Ref** (drawing_ref)
- **Bend Dimensions** (A–R in bend_dimensions JSON)

### Changes

**File: `src/components/office/DetailedListView.tsx`**

1. Add `editingItemId` state and `editValues` state to track which row is being edited and the draft values
2. Wire the Pencil button's `onClick` to enter edit mode for that row
3. When editing, render `<input>` fields instead of static text for editable columns
4. Add Save (Check icon) and Cancel (X icon) buttons in the actions column
5. On Save: call `supabase.from("cut_plan_items").update(...)` with changed values, then call `fetchItems()` to refresh
6. On Cancel: clear editing state

### Technical Details
- Edit state: `useState<string | null>(null)` for `editingItemId`
- Draft values stored in a `Record<string, any>` state
- Inputs styled as small inline fields matching the table cell widths
- Save calls Supabase directly (same pattern as `DeleteItemButton`)
- After save, invalidate query or call `fetchItems` from the hook

