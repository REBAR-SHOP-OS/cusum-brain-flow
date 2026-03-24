

## Fix: Vizzy Reports 0 Completed Pieces (Missing Column)

### Root Cause
The `vizzy-context` edge function queries `cut_plan_items.updated_at` to count today's completions — but **that column does not exist** on the `cut_plan_items` table. The query silently returns 0 rows.

### Database Reality (Today)
- 20 completed machine runs on CUTTER-01
- **896 pieces produced** (sum of `output_qty`)
- 104 items in `complete` phase, 53 in `clearance`
- No `updated_at` column on `cut_plan_items`

### Fix

**File: `supabase/functions/vizzy-context/index.ts`**

1. **Remove the broken `completedTodayItems` query** (line 90) that filters on non-existent `updated_at`

2. **Derive `completedToday` from `machine_runs`** — sum `output_qty` from today's completed runs (this data already exists in `machineRunsToday`)

3. **Add `totalPiecesProduced` to production snapshot** — sum of `output_qty` from completed machine runs today, giving Vizzy the actual piece count (896)

4. **Add operator names to machine runs** — currently all operators show as `null`; join `operator_profile_id` with profiles to show who ran each machine

5. **Redeploy** the edge function

### Snapshot Changes

```typescript
production: {
  completedToday: /* count of completed machine_runs today */,
  totalPiecesProduced: /* sum of output_qty from completed runs = 896 */,
  machineRunsToday: /* count */,
  // ... existing fields
},
machineRuns: {
  runs: [{ machine_name, process, status, output_qty, operator_name }], // add operator_name
}
```

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/vizzy-context/index.ts` | Fix completedToday from machine_runs, add totalPiecesProduced, add operator names |
| `src/types/vizzy.ts` | Add `totalPiecesProduced` and `operator_name` fields |
| Deploy | Redeploy `vizzy-context` |

