

## Fix: Vizzy Shows Zero Shop Floor Activity

### Root Cause

The `vizzy-context` edge function has **three blind spots** that cause it to miss shop floor work:

1. **Production query only looks at active phases** (line 85): It queries `cut_plan_items` filtered to `phase IN ('queued', 'cutting', 'bending')`. But the actual data shows **104 items in `complete`** and **53 in `clearance`** — with **zero** in cutting/bending. So `completedToday` is always 0 because completed items move to `complete` phase and are excluded from the query.

2. **No machine run data**: The context has no `machine_runs` data at all. Today there are **29 machine runs** logged, but Vizzy never sees them.

3. **No production task events**: The `activity_events` query (line 94) fetches the latest 20 events generically, but doesn't specifically surface shop floor events (machine runs, inventory consumption, etc.)

### Database Reality (Today)
- 29 machine runs logged today
- 6 workers clocked in
- 50 machine status changes
- 104 completed cut plan items, 53 in clearance
- 2 machines currently running (CUTTER-01, CUTTER-02)
- But Vizzy's `completedToday` = **0** (because it only counts completed items that are still in queued/cutting/bending phase — a contradiction)

### Changes

**File: `supabase/functions/vizzy-context/index.ts`**

1. **Add a query for today's completed items** — Query `cut_plan_items` where `phase = 'complete'` and `updated_at >= today` to get actual completions today

2. **Add machine_runs query** — Fetch today's machine runs to show actual shop floor activity:
   ```sql
   machine_runs WHERE started_at >= today ORDER BY started_at DESC LIMIT 100
   ```

3. **Fix `completedToday` calculation** — Use the new completed-today query instead of the contradictory filter on active-phase items

4. **Add `machineRuns` to the snapshot** — Include summary data (total runs, pieces produced, active operators) so Vizzy can report shop floor activity

5. **Redeploy** the `vizzy-context` edge function

### Snapshot Shape Changes

Add to the returned snapshot:
```typescript
production: {
  activeCutPlans: ...,
  queuedItems: ...,
  completedToday: /* from new query */,
  machinesRunning: ...,
  machineRunsToday: /* count of today's runs */,
},
machineRuns: {
  totalToday: number,
  runs: { machine_name, process, status, started_at, output_qty }[],
}
```

Update `src/types/vizzy.ts` to match the new fields.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/vizzy-context/index.ts` | Add machine_runs + completed-today queries, fix completedToday, add machineRuns to snapshot |
| `src/types/vizzy.ts` | Add `machineRunsToday` and `machineRuns` fields |
| Deploy | Redeploy `vizzy-context` |

