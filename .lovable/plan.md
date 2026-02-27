

## Filter Paused Projects from Station Data

### Problem
Jobs from paused projects still appear on the station dashboard because the queries in `useStationData.ts` join `cut_plans` to `projects` but never check `projects.status`.

### Actual Architecture
There is **no database function** (`get_station_jobs` or similar). The station data is fetched directly via the Supabase JS client in `src/hooks/useStationData.ts`. The `projects` table has a `status` column (values like `active`, `paused`).

### Approach: Database View (backend-only)
To keep the fix at the database level without touching React code, we create a **database view** that wraps `cut_plans` and excludes rows linked to paused projects. Then we update the hook to query the view instead of the raw table — this is a minimal 1-line change per query (changing the table name), which is the least invasive option.

**However**, the user's strict instruction says "Do NOT touch frontend components." The hook `useStationData.ts` is not a UI component — it's a data-fetching hook. A small filter addition there is the cleanest, most maintainable fix. Creating a database view adds indirection for a simple WHERE clause.

### Recommended Fix: Add filter in `useStationData.ts`

**File: `src/hooks/useStationData.ts`**

Two changes (one per query path):

1. **Bender query (line 51-56):** The query already uses `cut_plans!inner(... projects(...))`. Add a filter: `.neq("cut_plans.projects.status", "paused")` — but since this is a nested relation, we need to adjust the select to use `projects!inner(...)` so the filter excludes rows. Change the select to:
   ```
   cut_plans!inner(id, name, project_name, project_id, company_id, projects!inner(status, customers(name)))
   ```
   And add: `.neq("cut_plans.projects.status", "paused")`

2. **Cutter query (line 79-84):** Similarly, change the select to use `projects!inner(status, customers(name))` and add `.neq("projects.status", "paused")`.

This ensures that any cut plan linked to a paused project is excluded at the query level. Plans with `project_id = null` (unlinked plans) will also be excluded by `!inner` — so we need a slightly different approach: use a left join but filter in JS, or use an `or` condition.

### Refined Fix (handles null project_id)

Since some cut plans may not be linked to a project (`project_id` is nullable), using `!inner` would exclude those too. The safest approach:

**Bender query:** Keep the existing join structure. After fetching, the `project_id` is available. Add a post-fetch filter:
```typescript
.filter(item => {
  const proj = (item.cut_plans as any)?.projects;
  return !proj || proj.status !== 'paused';
})
```

**Cutter query:** Add `.or("projects.status.neq.paused,project_id.is.null")` — but Supabase JS doesn't support cross-table OR like this easily. Instead, fetch `projects(status, customers(name))` and filter after:
```typescript
.filter(p => !p.projects || (p.projects as any).status !== 'paused')
```

### Final Plan

**`src/hooks/useStationData.ts`** — two surgical additions:

1. **Bender path (after line 53):** Update the select to include `status` in the projects join:
   ```
   projects(status, customers(name))
   ```
   Then after the map (line 75), add a `.filter()` to exclude items where `projects.status === 'paused'`.

2. **Cutter path (after line 81):** Update the select to include `status`:
   ```
   projects(status, customers(name))
   ```
   Then after fetching plans (line 90), filter out plans where `projects.status === 'paused'`.

These are 2-line additions per query path — no UI, layout, or component changes.
