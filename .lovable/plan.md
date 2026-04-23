

## Plan — Send all ET CONSTRUCTION INC items back to the Cutter station

### Verified state (live DB)

ET CONSTRUCTION INC has 2 manifests with 5 items total. None are linked to delivery / loading / pickup — all safe to revert.

| Plan | Plan status | Item | Phase | Pieces | Bend |
|---|---|---|---|---|---|
| ET 11082 MALOCK PAK | `completed` | item-3799… | `clearance` | 16/16 | straight |
| ET 7800 BUS SHELTER TYPE Q | `queued` | item-d4d7… | `clearance` | 2/2 | straight |
| ET 7800 BUS SHELTER TYPE Q | `queued` | item-3769… | `clearance` | 10/10 | straight |
| ET 7800 BUS SHELTER TYPE Q | `queued` | item-1a9c… | `cut_done` | 4/4 | bend |
| ET 7800 BUS SHELTER TYPE Q | `queued` | item-e9ba… | `cut_done` | 4/4 | bend |

(The previously reverted "cutting" items from the prior fix have since been re-cut — the operator now wants the entire project rolled back to the Cutter station.)

### Fix — one database operation, no code changes

```sql
-- Send ALL ET CONSTRUCTION INC items back to the Cutter station
UPDATE public.cut_plan_items
SET phase = 'cutting',
    completed_pieces = 0,
    fulfillment_channel = NULL,
    ready_at = NULL,
    updated_at = now()
WHERE cut_plan_id IN (
        '8339c4e6-cde3-47dd-af0a-364299f17057',  -- ET 11082 MALOCK PAK
        '587adc69-4c02-44a1-a7d8-e85d9aee5a7b'   -- ET 7800 BUS SHELTER TYPE Q
      )
  AND phase IN ('cut_done', 'clearance', 'bending', 'complete')
  AND delivery_id IS NULL
  AND loading_list_id IS NULL
  AND pickup_id IS NULL;

-- Sync parent plan status back to queued so they reappear in the Cutter queue
UPDATE public.cut_plans
SET status = 'queued',
    updated_at = now()
WHERE id IN (
  '8339c4e6-cde3-47dd-af0a-364299f17057',
  '587adc69-4c02-44a1-a7d8-e85d9aee5a7b'
);
```

**Safety guards:**
- Scoped to exactly the two ET CONSTRUCTION INC plan IDs.
- Refuses any item already linked to a delivery, loading list, or pickup.
- Resets `completed_pieces = 0` so Cutter operator re-cuts from zero.
- Clears `fulfillment_channel` + `ready_at` so they won't appear on Ready-to-Ship.
- Reverts ET 11082 MALOCK PAK plan from `completed` → `queued`.

### Verification

```sql
SELECT cp.name, cpi.phase, cpi.completed_pieces, cpi.total_pieces
FROM cut_plan_items cpi
JOIN cut_plans cp ON cp.id = cpi.cut_plan_id
WHERE cpi.cut_plan_id IN (
  '8339c4e6-cde3-47dd-af0a-364299f17057',
  '587adc69-4c02-44a1-a7d8-e85d9aee5a7b')
ORDER BY cp.name;
-- expect: all 5 items at phase = 'cutting', completed_pieces = 0
```

### Result

| Surface | Before | After |
|---|---|---|
| 5 ET CONSTRUCTION items | mixed (clearance / cut_done) | all `cutting`, 0 pcs done |
| ET 11082 MALOCK PAK plan | `completed` | `queued` |
| ET 7800 BUS SHELTER TYPE Q plan | `queued` | `queued` (unchanged) |
| Cutter station queue | did not show these | shows both manifests, all 5 items |
| Clearance station | showed 3 items | hidden |
| Other customers / projects | untouched | untouched |

### Out of scope

- No frontend code changes.
- No trigger or RLS changes.
- No changes to other customers' plans or items.

### Files touched

None in the repo. **One database operation** with two scoped UPDATEs.

