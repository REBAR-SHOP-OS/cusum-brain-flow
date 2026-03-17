

# Fix Category Field & Add Button

## Changes

### `src/components/purchasing/PurchasingListPanel.tsx`
1. **Replace the Category `Input` with a `Select` dropdown** containing two options: "Office" and "Workshop"
2. The `newCategory` state default stays `""` — the Select placeholder shows "Category"
3. Ensure `handleAdd` properly passes the selected category to `addItem`

Specific edit: Lines 130-135 — replace