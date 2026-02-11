

## Fix: Cutter Station Not Updating Live

### Root Cause

Two problems prevent the Cutter station from updating in real-time:

**1. `cut_plans` table is missing from the realtime publication**
The `useStationData` hook subscribes to realtime changes on BOTH `cut_plan_items` and `cut_plans`. But only `cut_plan_items` is in the `supabase_realtime` publication. Changes to `cut_plans` (like status updates) never fire realtime events, so the subscription callback never runs for those changes.

**2. CutterStationView never manually invalidates the query after DB writes**
After `handleCompleteRun` updates the database, the component relies 100% on the realtime roundtrip (DB commit -> Postgres replication -> Supabase Realtime -> WebSocket -> client -> invalidation -> refetch) which can take 1-5 seconds or silently fail. Unlike `BenderStationView` (which we already fixed to call `queryClient.invalidateQueries`), CutterStationView has NO manual invalidation at all. The operator sees stale data until the realtime event eventually arrives -- or never, requiring a page navigation.

### Fix (2 changes)

**Change 1: Add `cut_plans` to realtime publication (migration)**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.cut_plans;
```

This ensures plan-level changes (status, machine assignment) also trigger realtime events.

**Change 2: Add manual query invalidation in CutterStationView**

- Import `useQueryClient` from `@tanstack/react-query`
- After the DB update in `handleCompleteRun` (line 300), immediately call `queryClient.invalidateQueries({ queryKey: ["station-data", machine.id, "cutter"] })` to force an instant refresh -- don't wait for the realtime roundtrip
- This mirrors the pattern already used in BenderStationView

### Files Modified

| File | Change |
|------|--------|
| Migration SQL | Add `cut_plans` to `supabase_realtime` publication |
| `src/components/shopfloor/CutterStationView.tsx` | Import `useQueryClient`, call `invalidateQueries` after DB update in `handleCompleteRun` |

### What This Does NOT Change
- No changes to `useStationData.ts` (the realtime subscription there is correct, it just wasn't receiving events for `cut_plans`)
- No changes to `BenderStationView.tsx` (already fixed)
- No UI changes, no schema changes

