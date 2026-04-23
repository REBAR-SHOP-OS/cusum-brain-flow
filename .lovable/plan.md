

## Plan — Send the 3 wrongly-completed items back to the **Cutter** station

### Verified state

The operator wrongly advanced 3 items to `complete` on these two manifests. None are linked to delivery / loading / pickup, so they're safe to revert.

| # | Manifest | Plan ID | Items to revert |
|---|---|---|---|
| 1 | ET 7800 BUS SHELTER TYPE Q | `587adc69-4c02-44a1-a7d8-e85d9aee5a7b` | 2 (10 pcs + 2 pcs) |
| 2 | CAGE 11' VERT X 18" DIA | `73c1e572-ac96-4fea-8786-f514136786e5` | 1 (8 pcs) |

### Revised target — **Cutter**, not Clearance

Per your correction, both manifests must go back to the **cutting** station (start of the flow), not to QC clearance.

```
queued → CUTTING ← target
       → cut_done → bending → clearance → complete
```

### Fix — one database operation, no code changes

```sql
-- Send the 3 wrongly-completed items back to the Cutter station
UPDATE public.cut_plan_items
SET phase = 'cutting',
    completed_pieces = 0,
    fulfillment_channel = NULL,
    ready_at = NULL,
    updated_at = now()
WHERE cut_plan_id IN (
        '587adc69-4c02-44a1-a7d8-e85d9aee5a7b',
        '73c1e572-ac96-4fea-8786-f514136786e5'
      )
  AND phase = 'complete'
  AND delivery_id IS NULL
  AND loading_list_id IS NULL
  AND pickup_id IS NULL;

-- Sync parent plan status back to queued/cutting state
UPDATE public.cut_plans
SET status = 'queued',
    updated_at = now()
WHERE id IN (
  '587adc69-4c02-44a1-a7d8-e85d9aee5a7b',
  '73c1e572-ac96-4fea-8786-f514136786e5'
);
```

**Safety guards:**
- Scoped to exactly these two plan IDs.
- Only touches rows currently at `phase = 'complete'`.
- Refuses any item already linked to a delivery, loading list, or pickup.
- Resets `completed_pieces = 0` so the Cutter operator re-cuts from zero.
- Clears `fulfillment_channel` + `ready_at` so they won't reappear on Ready-to-Ship.

### Verification

```sql
SELECT cut_plan_id, phase, completed_pieces, total_pieces
FROM cut_plan_items
WHERE cut_plan_id IN (
  '587adc69-4c02-44a1-a7d8-e85d9aee5a7b',
  '73c1e572-ac96-4fea-8786-f514136786e5')
ORDER BY 1, 2;
-- expect: all 6 items now show phase = 'cutting' (3 reverted + 3 already there),
--         the reverted ones with completed_pieces = 0
```

### Result

| Surface | Before | After |
|---|---|---|
| 3 wrongly-completed items | `phase = complete`, on Ready-to-Ship | `phase = cutting`, at Cutter station |
| Cutter station queue | did not show these | shows ET 7800 (2 items) + CAGE 11' (1 item) |
| Ready-to-Ship board | showed these 3 items | hidden |
| Other items on these plans (already at `cut_done`) | unchanged | unchanged |
| Other manifests / customers | untouched | untouched |

### Out of scope

- No frontend code changes.
- No trigger changes — `auto_advance_item_phase` already prevents future skip-to-complete mistakes.
- The previously-completed bend/cut_done siblings on these plans stay at their current phase.

### Files touched

None in the repo. **One database operation** with two scoped UPDATEs.

