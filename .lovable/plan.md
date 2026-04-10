

# Fix: "All Employees" Activity Scheduling

## Problem
The "Assign to" dropdown in the Schedule Activity form only shows the lead's current assignees. There is no "All Employees" option, and the backend (direct Supabase insert in `useScheduledActivities.ts`) only creates a single row per submission.

## Solution
All changes are frontend-only. No edge function needed — the `scheduled_activities` table accepts direct inserts with any `assigned_to` UUID.

### 1. Add "All Employees" option to `ScheduledActivities.tsx`
- Prepend a static "All Employees" option (value: `"__all__"`) to the assignee dropdown
- When `"__all__"` is selected, pass a flag to the mutation

### 2. Update `useScheduledActivities.ts` to handle bulk creation
- Accept an optional `allAssignees` array in `CreateActivityInput`
- When `assigned_name === "__all__"` and `allAssignees` is provided:
  - Build an array of insert rows (one per assignee)
  - Use `supabase.from("scheduled_activities").insert(rows)` (bulk insert)
- Otherwise, insert a single row as before

### 3. Wire up the assignees list in `ScheduledActivities.tsx`
- When "All Employees" is selected and form submitted, pass the full `assignees` array to the mutation
- Each created activity gets the correct `assigned_to` (profile_id) and `assigned_name` (full_name)

## Files Changed
- `src/components/pipeline/ScheduledActivities.tsx` — add "All Employees" option + pass assignees on submit
- `src/hooks/useScheduledActivities.ts` — bulk insert logic

## Scope
- 2 files, ~25 lines changed
- No database migration
- No edge function

