
# Kanban Board for Employee Tasks

## Overview
Replace the current grouped-table UI on `/tasks` with a horizontal Kanban board. One column per `@rebar.shop` employee, showing only tasks created by Neel.

## Scope
- Only `src/pages/Tasks.tsx` is modified (full rewrite of the render and data logic)
- No other files, pages, database tables, navigation, or policies change

## Data Rules
- Columns: all profiles where `email ILIKE '%@rebar.shop'` (fetched from `profiles` table with email field)
- Tasks shown: only where `created_by_profile_id = 'a94932c5-e873-46fd-9658-dc270f6f5ff3'` (Neel)
- Each column shows tasks where `assigned_to` matches that employee's profile ID
- New tasks created via `+` button automatically set `created_by_profile_id` to Neel's profile ID

## UI Layout

```text
+--[Employee Tasks]--[Refresh]-------------------------------------------+
|                                                                         |
|  +-- Column 1 -----+  +-- Column 2 -----+  +-- Column N -----+        |
|  | Ai (ai@)    [+]  |  | Behnam (ben@)[+]|  | ...          [+]|        |
|  | 2 tasks          |  | 0 tasks         |  |                  |        |
|  |                  |  |                  |  |                  |        |
|  | [x] Task title [-]|  |                  |  |                  |        |
|  | [x] Task title [-]|  |                  |  |                  |        |
|  |                  |  |                  |  |                  |        |
|  | -- Done --       |  |                  |  |                  |        |
|  | [v] Done task [-]|  |                  |  |                  |        |
|  +------------------+  +------------------+  +------------------+        |
|  <--- horizontal scroll if needed --->                                   |
+-------------------------------------------------------------------------+
```

- Each column is ~320px wide, full height with internal scroll
- Horizontal scroll container for all columns
- Column header: Employee name, email, task count badge, `+` button
- Task items: checkbox (left), title, minus icon (right)
- Completed tasks shown at bottom with reduced opacity

## Per-Task Item
- Checkbox on the left: toggles done/undone
  - Check: `status = 'completed'`, `completed_at = now()`
  - Uncheck: `status = 'open'`, `completed_at = null`
- Title in the middle (click opens detail drawer, same as current)
- Minus (`-`) icon on the right: shows confirm dialog, then deletes from DB

## Add Task (`+` button per column)
- Opens a small modal with: Title (required), Description, Priority (default Medium), Due Date
- On save creates task with:
  - `assigned_to` = that column's employee profile ID
  - `created_by_profile_id` = Neel's profile ID (hardcoded constant)
  - `status = 'open'`
  - `company_id` from current user's profile

## What is Preserved
- Detail drawer (Sheet) with description, metadata, audit log, copy, full-screen -- unchanged
- Full screen description dialog -- unchanged
- `writeAudit`, `toggleComplete`, `deleteTask`, `copyToClipboard`, `linkifyText` helpers -- unchanged
- All existing mutation logic and audit logging -- unchanged

## What is Removed
- Grouped-table layout (Collapsible + Table components)
- Filter bar (search, status, priority, due date, show completed)
- The `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` imports (no longer needed)
- Grouping/sorting/filtering `useMemo` blocks

## Technical Details

### Constants
- `NEEL_PROFILE_ID = 'a94932c5-e873-46fd-9658-dc270f6f5ff3'`

### Data Fetching
- Fetch profiles with email: `supabase.from("profiles").select("id, full_name, email, user_id").ilike("email", "%@rebar.shop")`
- Fetch tasks: `supabase.from("tasks").select("*, created_by_profile:profiles!tasks_created_by_profile_id_fkey(id, full_name)").eq("created_by_profile_id", NEEL_PROFILE_ID)`
- Group tasks client-side by `assigned_to` into a Map keyed by profile ID

### New Task Creation
- `created_by_profile_id` is always set to `NEEL_PROFILE_ID`
- This is a data convention, not a security concern, since the field is informational

### Delete Confirmation
- Use `window.confirm("Delete this task?")` for simplicity (no new component needed)
- On confirm: delete from DB, remove from local state, show toast

### Sorting Within Columns
- Active tasks (non-completed) first, sorted by: overdue first, then due_date asc, then priority, then created_at desc
- Completed tasks at bottom, sorted by completed_at desc

## Files Modified
1. `src/pages/Tasks.tsx` -- rewrite render to Kanban layout; update data fetching to filter by Neel and @rebar.shop employees
