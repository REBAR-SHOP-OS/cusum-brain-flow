

## Problem

The barlist "1000197066 ONTARIO INC." shows as **Draft** and **UNASSIGNED** in the Production Queue. It has no `machine_id` set on the `cut_plans` row, so when you click Cutter-01 or Cutter-02, the station view shows "No items queued to this machine" — there's nothing to start.

The flow requires: **Barlist → Assign to Machine → Items appear on Station → Start cutting**. Currently, assigning a barlist to a machine can only be done from the Office view (QueueToMachineDialog). The Shop Floor Production Queue is read-only.

## Solution

Add an "Assign to Machine" action on each barlist row in the Shop Floor Production Queue. Clicking it opens a small dialog where the operator picks a cutter machine, which sets `cut_plans.machine_id` and updates status to `queued`. After that, items appear on the selected cutter's station view and can be started.

## Changes

### 1. `src/components/shopfloor/ShopFloorProductionQueue.tsx`
- Add a clickable "Assign" button (or the entire barlist row) on each barlist that has no machine assigned
- On click, show a small machine picker dialog (inline dropdown or modal)
- On selection: update `cut_plans.machine_id` and `cut_plans.status` to `queued`
- Show which machine a barlist is already assigned to (if any)
- Use existing `useCutterMachines()` hook to get available machines

### 2. Wire up the assignment
- Query `cut_plans` matching each barlist's project to find the relevant plan
- Or join barlists → cut_plans directly if the barlist ID maps to a cut_plan
- Update `machine_id` on the cut_plan row and set status from `draft` to `queued`
- Invalidate station-data queries so the machine's station view refreshes

### Files Modified
- `src/components/shopfloor/ShopFloorProductionQueue.tsx` — add assign-to-machine action per barlist row

