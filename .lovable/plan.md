

## Investigation: "0 Manifests" in Production Queue

### Root Cause

The session **"done done"** is stuck at status `validated` — the **Approve** step was never completed. Here's the data state:

| Entity | Status |
|--------|--------|
| Extract session | `validated` (17 rows exist) |
| Barlist | Exists, but 0 barlist_items |
| Cut plan (manifest) | **Does not exist** |
| Work order | **Does not exist** |

The "manifests" count in the Production Queue equals the number of `cut_plans` linked to each barlist. Since the Approve step was never run, no cut_plan was created, hence **0 manifests**.

### Second Problem: Fragile Matching Logic

Even when cut_plans exist, the current code matches them to barlists **by name**:
```
p.name === b.name || p.project_name === b.name
```
This is fragile — if names differ slightly, manifests won't appear under their barlist.

### Fix (2 parts)

**1. Add `barlist_id` to `cut_plans` table** — Create a direct FK relationship instead of relying on name matching.

- Migration: `ALTER TABLE cut_plans ADD COLUMN barlist_id UUID REFERENCES barlists(id) ON DELETE SET NULL;`
- Update `manage-extract/index.ts` approve flow to set `barlist_id` when creating the cut_plan
- Add error logging if cut_plan insert fails (currently silent)

**2. Fix matching in `ProductionQueueView.tsx`** — Update `buildCustomerTree` to:
- Primary match: `cut_plan.barlist_id === barlist.id` (new FK)
- Fallback match: name-based (existing logic for legacy data)
- Include `barlist_id` in the `useCutPlans` query

**3. Re-approve the stuck session** — After deploying the fix, the user needs to click Approve on the "done done" session in AI Extract to create the manifest/cut_plan.

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `barlist_id` column to `cut_plans` |
| `supabase/functions/manage-extract/index.ts` | Set `barlist_id` on cut_plan insert + add error handling |
| `src/hooks/useCutPlans.ts` | Add `barlist_id` to CutPlan interface and query |
| `src/components/office/ProductionQueueView.tsx` | Match by `barlist_id` first, then name fallback |

