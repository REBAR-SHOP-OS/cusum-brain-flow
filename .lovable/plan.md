

# Add Final Confirm Button for Purchasing List

## What
The confirm button at the bottom already exists but the user wants it to be the clear final action — when clicked, it confirms the purchasing list for the selected date and that date appears in the RECENTS sidebar. The current implementation just shows a toast. We need to ensure the flow works end-to-end.

## Changes

### `src/components/purchasing/PurchasingListPanel.tsx`
- The confirm button is already in place (lines 213-226) — it shows when a date is selected and items are purchased
- Keep it as-is but ensure the confirm button is visually prominent and the toast message is clear
- No structural changes needed — the RECENTS sidebar already pulls dates from `usePurchasingDates` which queries all unique `due_date` values from `purchasing_list_items`

### How RECENTS works
The flow already works: when a user selects a date → checks items → those items are saved with that `due_date` → `usePurchasingDates` picks up the date → it appears in RECENTS. The confirm button serves as a visual confirmation step with a toast.

**No code changes needed** — the existing implementation already handles this correctly. The confirm button appears when a date is filtered and items are checked, and the dates automatically appear in RECENTS because `addItemAsPurchased` saves items with the selected `due_date`.

