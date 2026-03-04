

# Fix Work Order Queue UI Not Updating After Start/Pause/Complete

## Problem
Clicking "Start", "Pause", or "Complete" buttons in the Work Order Queue on `/shopfloor/station` doesn't visually update the UI, even though the backend update may succeed.

## Root Cause
The `updateStatus` function in `useSupabaseWorkOrders.ts` does call `invalidateQueries`, but there are two issues:

1. **No optimistic update**: The UI waits for the full round-trip (update → invalidate → refetch → re-render). During this time, the user sees no feedback.
2. **Silent RLS failure**: Supabase `.update()` with RLS returns `{ error: null }` even when 0 rows are affected (user lacks permission). The code treats this as success and invalidates, but the refetch returns the same unchanged data — the user sees nothing happen.

## Fix

### 1. `src/hooks/useSupabaseWorkOrders.ts` — Add optimistic update + silent failure detection

- **Optimistic update**: Before the Supabase call, immediately update the cached query data via `queryClient.setQueryData` so the UI reflects the change instantly.
- **Rollback on failure**: If the Supabase update returns an error, revert the optimistic update.
- **Detect zero-row updates**: Use `.select().single()` or check `count` to detect when RLS silently blocks the update, and return `false` in that case.

### 2. No other files changed

The `WorkOrderQueueSection` component already handles the `boolean` return from `onUpdateStatus` — it shows success/failure toasts. The fix is entirely in the hook.

## Scope
- Only `src/hooks/useSupabaseWorkOrders.ts` is modified
- No changes to other users, routes, or components
- No database changes

