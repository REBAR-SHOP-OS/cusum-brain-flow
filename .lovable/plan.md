

## Plan — Get cleared items off the Clearance Station + prevent recurrence

### Root cause (verified live)

| Plan | Item | bend_done / total | evidence | `phase` |
|---|---|---|---|---|
| GRADE BEAM 1 + LOOSE REBAR (505 GLENLAKE) | `35530866…` | 40 / 40 | `cleared` 2026-04-17 | **stuck `clearance`** |
| Rebar Cage (INNIS COLLEGE) | `69b66d16…` | 0 / 30 | `cleared` 2026-04-20 | **stuck `clearance`** |

The Clearance Station hook (`useClearanceData.ts:40`) filters strictly on `phase = 'clearance'`. Operator marked evidence "cleared" days ago, but the `auto_advance_item_phase` trigger never moved them to `phase = 'complete'` — so they keep showing.

### Two-part fix

**Part 1 — Unblock the two stuck items now (data fix)**

```sql
UPDATE public.cut_plan_items
SET phase = 'complete',
    ready_at = COALESCE(ready_at, now()),
    updated_at = now()
WHERE id IN (
  '35530866-f77a-4729-bc2e-87704363029b', -- GRADE BEAM 1
  '69b66d16-077c-4c82-b967-c0262e8bfff3'  -- Rebar Cage
)
AND phase = 'clearance'
AND EXISTS (
  SELECT 1 FROM public.clearance_evidence ce
  WHERE ce.cut_plan_item_id = cut_plan_items.id
    AND ce.status = 'cleared'
);
```

Both items have `delivery_id`, `loading_list_id`, `pickup_id` all NULL → safe to advance to Ready-to-Ship.

**Part 2 — Filter cleared items out of the Clearance Station UI (frontend safety net)**

Even with the data fix, future items can drift into the same stuck state if the trigger has gaps. Add a defensive filter in `src/hooks/useClearanceData.ts`: after building the `ClearanceItem[]`, exclude items where `evidence_status === 'cleared'` from the rendered list, so cleared items never linger on the station regardless of `phase` value.

Specifically, line 110-111 currently computes `clearedCount` against the full list. Change to:
- Compute `clearedCount` and `totalCount` first (header still shows "2/2 Cleared" briefly until refetch).
- Then filter the cleared items out before grouping into `byProject`. Result: cleared cards disappear immediately on the next refetch.

This is purely additive — does not touch the DB trigger, does not change RLS, does not break the existing realtime subscription.

### Out of scope (deliberate)

- Not touching `auto_advance_item_phase` trigger logic — root-causing the trigger gap is a separate, larger investigation. The frontend filter makes it a non-issue for the operator.
- Not touching evidence rows, photos, verifier names, or any other plan/item data.
- No changes to other stations (Cutter, Bender, Ready-to-Ship).

### Verification

```sql
SELECT cp.name, cpi.id, cpi.phase
FROM cut_plan_items cpi JOIN cut_plans cp ON cp.id = cpi.cut_plan_id
WHERE cpi.id IN ('35530866-f77a-4729-bc2e-87704363029b','69b66d16-077c-4c82-b967-c0262e8bfff3');
-- expect: both at phase = 'complete'
```

Then reload `/shopfloor/clearance` → both manifests gone.

### Files touched

1. **DB operation** — one scoped UPDATE on 2 specific item IDs.
2. **`src/hooks/useClearanceData.ts`** — add a filter so any item with `evidence_status === 'cleared'` is excluded from `byProject` (the grouped map the station renders). ~5 lines.

