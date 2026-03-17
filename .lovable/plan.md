

# Purchasing List: Remove X Icon, Add Confirm Button, Show in Recents

## What
1. **Remove the red X (✗) button** from both default items and dynamic items — each item only has a single check toggle (tap to mark purchased, tap again to unmark)
2. **Add a "Confirm" button** that appears only when a date is selected and at least one item has been checked/changed — clicking it saves the date entry to the sidebar RECENTS
3. **Show confirmed purchasing dates in RECENTS** section of the sidebar (already partially working via `usePurchasingDates`)

## Changes

### 1. `src/components/purchasing/CompanyDefaultItems.tsx`
- Remove the X button from `DefaultRow` — keep only the green check button as a toggle (clicking it when purchased → unmarks it)
- Update click handler: if not purchased → `onMarkPurchased`, if purchased → `onUnmarkPurchased`

### 2. `src/components/purchasing/PurchasingListPanel.tsx`
- Remove the X button from the dynamic items list — same toggle logic as defaults
- Add a sticky "Confirm" button at the bottom that shows only when `filterDate` is set and there are purchased items
- On confirm click: show a success toast ("List confirmed for {date}") — the date already auto-appears in RECENTS because `usePurchasingDates` fetches all unique `due_date` values from the DB
- Ensure items added/toggled get the selected `filterDate` as `due_date` so they appear under that date in RECENTS

### 3. `src/hooks/usePurchasingList.ts`
- Update `addItemAsPurchased` to accept an optional `dueDate` parameter and pass it when inserting — so default items checked while a date is selected get that date
- This ensures the date appears in `usePurchasingDates` and thus in the RECENTS sidebar

## Flow
1. User selects a date via Calendar
2. Checks items (office/workshop defaults or custom)
3. A green "✓ Confirm" button appears at the bottom
4. User clicks confirm → toast confirmation → date appears in RECENTS sidebar

