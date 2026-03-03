

# Fix: Work Order Queue UI Not Updating After "Start"

## Root Cause

`useSupabaseWorkOrders` uses manual `useState` + a raw `fetch` function, while the rest of the app uses TanStack React Query. The `updateStatus` callback is wrapped in `useCallback([data])` but captures a potentially stale `fetch` reference (not in the dependency array). More critically, after calling `updateStatus`, no other React Query caches are invalidated — so sibling components (ActiveProductionHub, ShopFloorProductionQueue) don't refresh either.

## Fix

**File: `src/hooks/useSupabaseWorkOrders.ts`** — Convert to React Query:

1. Replace manual `useState`/`useEffect` fetch with `useQuery({ queryKey: ["work-orders"], queryFn: ... })`.
2. Replace `updateStatus` with a function that does the supabase update, then calls `queryClient.invalidateQueries({ queryKey: ["work-orders"] })`.
3. Also invalidate `["cut-plans"]` and `["station-data"]` in the same callback so sibling components refresh.
4. Remove the `useCallback` wrapper entirely — React Query handles caching.

The return shape stays the same (`{ data, loading, error, updateStatus }`) so no changes needed in `StationDashboard.tsx` or `WorkOrderQueueSection.tsx`.

**File: `src/pages/StationDashboard.tsx`** — Add a realtime subscription for `work_orders` table that invalidates `["work-orders"]` query key (consistent with the pattern used in `useProjects.ts`).

## Files Changed
- `src/hooks/useSupabaseWorkOrders.ts` — rewrite to React Query
- `src/pages/StationDashboard.tsx` — add realtime channel for work_orders

