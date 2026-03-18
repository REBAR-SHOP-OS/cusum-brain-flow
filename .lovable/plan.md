

## Plan: Add Delete Button to Purchasing Date Entries in Sidebar

### Problem
The purchasing agent's sidebar shows date entries (e.g., 2026-03-20, 2026-03-19) but has no way to delete them. User wants a trash icon on each date row.

### Changes

**1. `src/hooks/usePurchasingDates.ts`** — Add `deleteConfirmedList` function
- Delete the `purchasing_confirmed_lists` record matching `due_date` and `company_id`
- Call `fetchDates()` after deletion to refresh the list

**2. `src/components/agent/AgentHistorySidebar.tsx`** — Add trash icon to purchasing date rows
- Add `onDeletePurchasingDate` optional prop
- Add a `Trash2` icon button (same pattern as session delete — hidden by default, visible on hover via `group` class)
- Wire `onClick` with `e.stopPropagation()` to prevent selecting the date

**3. `src/pages/AgentWorkspace.tsx`** — Wire the delete callback
- Destructure `deleteConfirmedList` from `usePurchasingDates`
- Pass `onDeletePurchasingDate={deleteConfirmedList}` to `AgentHistorySidebar`
- If the deleted date is the active one, reset to today

