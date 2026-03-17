

# Fix: Cutter Station Shows Empty — Plan Status Not Syncing with Item Completion

## Root Cause

The cutter station query filters `cut_plan_items` by `phase IN ('queued', 'cutting')`, but **every item in the database has phase `complete` or `clearance`** — zero items have phase `queued`. Meanwhile, the parent `cut_plans` still show `status = 'queued'` because **there is no automation to transition plan status when all items finish**.

This creates a mismatch: the `ShopFloorProductionQueue` (your screenshot) shows 12 "ACTIVE" plans with status "QUEUED", but clicking into the cutter station reveals nothing because all underlying items are already cut.

**Data proof:**
- `cut_plan_items` phases: 57 `complete`, 19 `clearance`, **0 `queued`**, **0 `cutting`**
- `cut_plans` status: all 12 active plans still `queued`

## Fix: Two-Part Solution

### Part 1 — Database Trigger: Auto-Complete Plans

Create a trigger on `cut_plan_items` that checks after each phase update whether ALL items in the parent plan have reached a terminal phase (`complete` or `clearance`). If so, automatically set the plan's status to `complete`.

```sql
CREATE FUNCTION auto_complete_cut_plan() ...
-- After UPDATE on cut_plan_items.phase
-- If all sibling items are 'complete' or 'clearance', set cut_plans.status = 'complete'
```

### Part 2 — One-Time Data Fix

Run a migration to fix the 12 currently stuck plans: set any `cut_plans` to `status = 'complete'` where ALL their items are already in terminal phases.

### Part 3 — Show "Complete" Items on Cutter When Plan Active (Safety Net)

As a secondary improvement, if a plan is `queued`/`running` but items are `complete`, the cutter station should still show them (in a muted "already cut" state) rather than showing nothing. This prevents operator confusion. Update the phase filter in `useStationData.ts` to include `complete` items from active plans, marked visually as done.

## Files Changed

| File | Change |
|------|--------|
| New DB migration | Trigger `auto_complete_cut_plan` + one-time data fix |
| `src/hooks/useStationData.ts` | Widen phase filter to include `complete` items from active plans (shown as done) |

