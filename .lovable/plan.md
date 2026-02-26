

## Plan: Fix Station Dashboard — Show Pending Queue & Hide Empty Cutters

### Problem 1: No Project Queue Visible
The Work Order Queue only shows orders with `in_progress` or `on_hold` status. All 17 work orders are `pending`, so the queue is hidden entirely. Operators have no way to start work.

### Problem 2: Empty Cutters in Active Production Hub
Cutters appear in the hub even when they have no assigned plans, no progress, and no jobs — making them clickable but useless.

### Changes

**1. `src/components/shopfloor/WorkOrderQueueSection.tsx`**
- Include `pending` work orders in the `activeOrders` filter (line 22-24)
- Group pending orders under a "Pending / Ready to Start" section so operators can start them
- Update status config to style pending as "READY" with a neutral/info color

**2. `src/components/shopfloor/ActiveProductionHub.tsx`**
- Tighten the `workingMachines` filter (line 23-25): only include machines that have **both** `status === "running"` **and** actual assigned plans or non-zero progress
- Remove machines from the hub that are "running" but have 0 plans and 0/0 pieces (empty state)
- Alternative simpler fix: only show machines in the hub if `plansByMachine.get(machine.id)?.length > 0` or `machineProgress.get(machine.id)?.total > 0`

### Files Modified
- `src/components/shopfloor/WorkOrderQueueSection.tsx`
- `src/components/shopfloor/ActiveProductionHub.tsx`

