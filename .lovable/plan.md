

## Fix: "New Chat" Should Reset Purchasing List to Clean State

### Root Cause
When "New Chat" is pressed, `resetPurchasingItems` only deletes items where `due_date IS NULL`. Items that were previously confirmed (and received a `due_date`) remain in the database. Since the panel loads with no date filter, ALL items (including dated/purchased ones) appear — so the list still shows green/selected items.

### Solution
Change `resetPurchasingItems` in `AgentWorkspace.tsx` to delete **all** purchasing items for the company, not just undated ones. Confirmed lists are already preserved as snapshots in the `purchasing_confirmed_lists` table, so no data is lost.

### Changes

**File: `src/pages/AgentWorkspace.tsx`** (lines 213-221)
- Remove the `.is("due_date", null)` filter from the delete query so ALL items for the company are deleted on reset

**File: `src/hooks/usePurchasingList.ts`** (lines 260-267)
- Same fix in the hook's `resetItems` for consistency — remove `.is("due_date", null)`

### Result
- "New Chat" → all items deleted → panel remounts → default list shows with zero selections
- Historical confirmed lists remain safe in the snapshots table

