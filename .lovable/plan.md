

# Fix: Pause Button and End-to-End Work Order Queue Audit

## Problems Found

### 1. RLS blocks workshop users from updating work orders
The UPDATE policy on `work_orders` only allows `admin` and `office` roles. Workshop users operating the Station Dashboard cannot Start, Pause, or Complete any work order.

**Fix**: Update the RLS UPDATE policy to include `workshop` role:
```sql
DROP POLICY "Office staff can update work_orders" ON public.work_orders;
CREATE POLICY "Staff can update work_orders" ON public.work_orders
  FOR UPDATE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin','office','workshop']::app_role[])
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = work_orders.order_id
        AND o.company_id = get_user_company_id(auth.uid())
    )
  );
```

### 2. `on_hold` status excluded from empty-shell filter
In `fetchWorkOrders()`, the filter at line 58-59 preserves `in_progress` and `completed` WOs even without cut_plan_items, but `on_hold` is missing. A paused WO could vanish from the list.

**Fix** in `src/hooks/useSupabaseWorkOrders.ts` line 59: add `|| wo.status === "on_hold"`.

### 3. Silent failure — no error feedback
When `updateStatus` fails (RLS or otherwise), it returns `false` but the UI ignores it. No toast, no visual feedback.

**Fix** in `src/components/shopfloor/WorkOrderQueueSection.tsx`: Add error toasts when `onUpdateStatus` returns `false`. Also add `console.error` in `updateStatus` for debugging.

### 4. Realtime subscription missing `production-queues` invalidation
The realtime channel in `StationDashboard.tsx` only invalidates `["work-orders"]` but doesn't invalidate `["production-queues"]` or `["cut-plans"]`, so sibling components may not refresh on external changes.

**Fix** in `StationDashboard.tsx`: Expand the realtime callback to also invalidate `["production-queues"]` and `["cut-plans"]`.

## Files Changed
- **Database migration**: Update `work_orders` UPDATE RLS policy to include `workshop`
- **`src/hooks/useSupabaseWorkOrders.ts`**: Add `on_hold` to empty-shell filter exception; add error logging
- **`src/components/shopfloor/WorkOrderQueueSection.tsx`**: Add error toast when status update fails
- **`src/pages/StationDashboard.tsx`**: Expand realtime invalidation to cover all related query keys

