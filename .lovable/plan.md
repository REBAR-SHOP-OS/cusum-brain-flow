

# Task Was Created — Board Needs Auto-Refresh

## What happened
The task "Update CRA Status for All Companies" **was successfully created** in the database (ID: `f96b00a9...`), correctly assigned to Vicky Anderson, with status `open` and `company_id` matching your account. It IS in the database right now.

The reason you don't see it on the Employee Tasks board is that the board **does not auto-refresh** — it only loads data when the page first opens or when you click the ↻ refresh button in the top-right corner.

## Fix: Add realtime subscription to Tasks page

**File: `src/pages/Tasks.tsx`**

Add a Supabase Realtime subscription on the `tasks` table so that any INSERT/UPDATE/DELETE triggers an automatic data reload. This way, when Vizzy (or any agent) creates a task, it appears on the board within seconds — no manual refresh needed.

Changes:
1. Subscribe to `postgres_changes` on `public.tasks` table inside the existing `useEffect`
2. On any change event → call `loadData()` to refresh the board
3. Cleanup subscription on unmount

Additionally, ensure the `tasks` table has realtime enabled:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
```

## Result
- Tasks created by Vizzy or any agent will appear on the board automatically within 1-2 seconds
- No need to manually click refresh
- Existing manual refresh button still works

