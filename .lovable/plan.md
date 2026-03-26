

# Fix: Stale Cut Plan Status for Completed STAIRS Plans

## Problem
STAIRS#21, #23, #25 show in Active Production Hub (plan status = `queued`) but not in the Station View (all items fully cut). The `auto_complete_cut_plan` trigger didn't transition these plans to `completed`.

## Root Cause
The plans' items are 100% complete (every `completed_pieces == total_pieces`), but `cut_plans.status` is still `queued`. Two issues:
1. **Immediate**: These 3 plans need a data fix
2. **Systemic**: The auto-complete trigger may have a gap — it might only fire on phase changes, not when completed_pieces reaches total_pieces during the approval/import flow

## Plan

### Step 1 — Data fix (migration)
Update the 3 orphaned plans to `completed` status:
```sql
UPDATE cut_plans 
SET status = 'completed', updated_at = now()
WHERE id IN (
  '5d80d272-11dc-4ff3-afab-02a32cb9e766',
  '01d2c010-cd64-4f65-aeef-0e5a4ac0cdd2',
  'e9db7412-5c4f-420f-9498-03edf919c1a1'
)
AND status = 'queued';
```

### Step 2 — Audit the auto_complete trigger
Inspect the `auto_complete_cut_plan` trigger to verify it covers all completion paths (phase transitions AND bulk completed_pieces updates during import). If a gap exists, patch the trigger condition.

### Step 3 — Add safety net in ActiveProductionHub
Filter out plans from the Production Hub where **all items are 100% complete** to prevent future ghost entries, regardless of plan status lag.

### Files Changed

| File | Change |
|---|---|
| Migration SQL | Data fix for 3 stale plans |
| `auto_complete_cut_plan` trigger | Audit + patch if gap found |
| `src/components/shopfloor/ActiveProductionHub.tsx` | Filter out fully-completed plans from display |

