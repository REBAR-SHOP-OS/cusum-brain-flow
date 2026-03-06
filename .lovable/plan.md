

# Fix: Route cutter items by bar_code capability, not by plan assignment

## Root Cause

`useStationData` (cutter path, line 86-91) fetches plans using `.eq("machine_id", machineId)`, then filters items by capability. If a plan assigned to Cutter-01 contains 20M items, those items are:
- Hidden on Cutter-01 (capability filter removes them)
- Invisible on Cutter-02 (plan isn't assigned there)

Items disappear silently.

## Fix — 2 changes

### 1. `src/hooks/useStationData.ts` — Cutter query: fetch by capability, not plan assignment

Replace the cutter query logic (lines 85-135). Instead of fetching plans by `machine_id` then filtering items, directly query `cut_plan_items` where `bar_code` is in this machine's capabilities:

```
1. Fetch machine_capabilities for this machine (process=cut) → get allowed bar_codes
2. Fetch ALL cut_plan_items where bar_code IN allowed_bar_codes 
   AND phase IN (queued, cutting)
   AND cut_plan.company_id = companyId
   AND cut_plan.status IN (draft, queued, running)
3. No plan.machine_id filter at all
```

This ensures every item automatically appears on the correct station based purely on bar_code.

### 2. Remove the DB trigger `trg_validate_machine_capability`

Create a migration to drop the trigger and function. The routing is handled at the query level — no need for a trigger that blocks operations.

```sql
DROP TRIGGER IF EXISTS trg_validate_machine_capability ON public.cut_plans;
DROP FUNCTION IF EXISTS public.validate_cut_plan_machine_capability();
```

### What stays the same
- `QueueToMachineDialog` auto-split logic stays (nice-to-have for plan organization)
- `machineRegistry.ts` — untouched
- Bender query path — untouched

