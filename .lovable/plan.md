

## Plan: Replace Station Queue with Work Order Queue

### Problem
The Station Dashboard currently shows cut plan queues grouped by machine (MachineGroupSection). The user wants to show work order queues instead.

### Changes

**1. Update `src/pages/StationDashboard.tsx`**
- Remove the `useCutPlans` import and all cut-plan-related logic (machineGroups, sortPlans, assignToMachine, runningPlans, queuedPlans)
- Import and use `useSupabaseWorkOrders` instead
- Replace the MachineGroupSection block (lines 134-157) with a new `WorkOrderQueueSection` component
- Keep MaterialFlowDiagram, ActiveProductionHub (pass empty arrays for activePlans), and MachineSelector

**2. Create `src/components/shopfloor/WorkOrderQueueSection.tsx`**
- New component that displays work orders in a collapsible list, grouped by workstation (or "Unassigned")
- Each work order row shows: work_order_number, status badge, customer_name, order_number
- Action buttons: Start (pending→in_progress), Pause, Complete
- Update work order status via supabase directly
- Style consistent with existing MachineGroupSection (collapsible, badges, same border/card patterns)

**3. Update `useSupabaseWorkOrders` hook**
- Add join to fetch customer name: `select("*, orders(order_number, customers(name))")`
- Add `customer_name` and `order_number` to the `SupabaseWorkOrder` interface
- Add `updateStatus` function for changing work order status

### Files
- `src/hooks/useSupabaseWorkOrders.ts` — add joins + status update
- `src/components/shopfloor/WorkOrderQueueSection.tsx` — new component
- `src/pages/StationDashboard.tsx` — swap cut plan queues for work order queues

