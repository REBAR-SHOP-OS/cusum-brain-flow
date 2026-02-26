

## Plan: Hide Empty Production Sections on Station Dashboard

### Problem
The Active Production Hub and Work Order Queue display on the Station Dashboard even when the production queue (`machine_queue_items`) is empty and no work is actively running. Machines show "LIVE" with 0/0 pieces and pending work orders clutter the view.

### Changes

**1. `src/components/shopfloor/ActiveProductionHub.tsx`**
- Currently line 87 checks `allWorkingMachines.length === 0 && unassignedPlans.length === 0` and shows "No machines currently running" placeholder
- Change: Also hide when all machines have 0 progress and no active plans assigned — show only machines that actually have cut plans with items in progress

**2. `src/components/shopfloor/WorkOrderQueueSection.tsx`**
- Currently shows all work orders grouped by workstation
- Change: Filter to only show work orders with `status = 'in_progress'` or `status = 'on_hold'` (active production). Hide the section entirely when no work orders are actively being worked on.

**3. `src/pages/StationDashboard.tsx`**
- Pass `activePlans` data to `ActiveProductionHub` (currently passing empty array `[]`)
- Fetch active cut plans using existing hooks so the hub can properly determine what's actually running

### Result
When the production queue is empty and no work orders are in progress, these sections won't appear, giving a clean dashboard. They'll appear automatically once production starts.

