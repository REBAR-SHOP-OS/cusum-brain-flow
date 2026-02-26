

## Plan: Filter Work Order Queue to Only Show Production-Ready Orders

### Problem
The Station Dashboard Work Order Queue shows all 17 pending work orders, but **none of them have any cut plan items** (0 items each). They are empty shells auto-generated from orders. The only real active job is the "Sector Contracting Ltd / Vault / Wall-E" entry visible in the Production Queue — which uses a different data path entirely.

### Root Cause
Work orders are created automatically when orders are made, but they don't have production content (cut_plan_items) linked to them yet. The Station Dashboard blindly shows all pending WOs regardless of whether they have work to do.

### Solution Options

**Option A (Recommended): Hide empty work orders from Station Dashboard**
- In `useSupabaseWorkOrders.ts`, add a subquery or post-fetch filter to exclude work orders that have zero `cut_plan_items`
- This ensures only production-ready WOs appear in the queue
- Result: The queue would currently be empty (since no WOs have items), which is correct — the active job lives in the Production Queue

**Option B: Show Production Queue items on Station Dashboard**
- Surface the Production Queue data (from `useProductionQueues`) more prominently on the Station Dashboard alongside or instead of the Work Order Queue
- This would show the actual active job (Wall-E / Sector Contracting)

### Recommended Changes

**1. `src/hooks/useSupabaseWorkOrders.ts`**
- After fetching work orders, run a secondary query to get `cut_plan_items` counts per work order
- Filter out WOs with 0 items before returning
- Or use a database view/join to do this in one query

**2. `src/components/shopfloor/WorkOrderQueueSection.tsx`**
- Add a small empty-state message when all WOs are filtered out: "No production-ready work orders. Check the Production Queue."

### Files Modified
- `src/hooks/useSupabaseWorkOrders.ts` — filter out empty work orders
- `src/components/shopfloor/WorkOrderQueueSection.tsx` — add empty state with link to Production Queue

