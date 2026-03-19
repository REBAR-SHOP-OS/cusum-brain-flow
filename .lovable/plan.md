

# Fix X Button: Deselect Instead of Reject

## Problem
The X button next to items currently marks them as **rejected** (red state with `is_rejected = true`). The user wants it to simply **deselect** — i.e., remove the purchased (green) status and return the item to pending/unchecked state. It should NOT reject/delete the item.

## Changes

### 1. Update X button behavior in `CompanyDefaultItems.tsx`

**Default item rows (line ~128-147):** Change the X button's `onClick` to call `onTogglePurchased` (to un-purchase) instead of `onToggleRejected`. Only show/enable the X button when the item is currently purchased (green), since its only purpose is to undo the purchase state.

**Custom item rows (line ~189-191):** Same change — X button calls `onTogglePurchased(item.id, true)` to un-check the purchased state instead of toggling rejected.

### 2. Visual update
- Remove the red rejected styling from the X button (`text-red-500`, `bg-red-500/20`)
- Style it as a neutral "undo" action — muted color, only visible/active when item is purchased
- Keep the Trash2 delete button separate (it stays as-is for actual deletion)

### 3. Remove rejected state logic (optional cleanup)
Since the X button no longer rejects items, the `is_rejected` visual states (red background, red text, strikethrough) on these rows become unreachable from the UI. The underlying `toggleRejected` hook function remains available for the AI agent but the manual UI buttons will no longer trigger it.

## Summary
- X button = **undo purchase** (green → default)  
- ✓ button = **mark purchased** (default → green)  
- 🗑 button = **delete item** (unchanged)

