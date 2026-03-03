

# Fix: Auto-update Work Order Status When Cut Plan Is Queued

## Problem
When a cut plan is queued to a machine (via `QueueToMachineDialog`), the associated work order status remains `pending` ("READY" + "Start" button). The cut plan items are already on the cutter, but the WO doesn't reflect that — it looks like nothing has started.

## Root Cause
`QueueToMachineDialog.handleQueue()` updates `cut_plans.status → queued` and creates `machine_runs`, but never touches the `work_orders` table. There's no trigger or logic linking cut plan status changes back to the parent work order.

## Fix

### `src/components/cutter/QueueToMachineDialog.tsx`
After updating the cut plan status to `queued` (line 78), add logic to update linked work orders to `in_progress`:

1. Query distinct `work_order_id` values from the plan's `cut_plan_items`
2. For each non-null work order ID, update `work_orders.status` to `in_progress` and set `actual_start` if not already set
3. Invalidate the `work-orders` query cache

This is a ~10-line addition after the existing `cut_plans.update` call. No migration needed.

