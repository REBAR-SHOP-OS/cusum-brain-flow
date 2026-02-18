
# Employee Tasks -- Replace Agent Tasks on /tasks

## Overview
Replace the current agent-based task listing with an employee-grouped table view. Tasks will be grouped by assigned employee, with collapsible sections, inline editing, search, filters, a creation modal, and a details drawer with audit log.

## Scope
- **Only** `/tasks` page and its navigation label
- No changes to any other pages, modules, database tables (other than tasks + new audit table), or application logic

---

## Phase 1: Database Migration

### 1A. Add `created_by_profile_id` to `tasks`
- Add column `created_by_profile_id UUID REFERENCES profiles(id)` (nullable, for existing rows)
- The existing `assigned_to` column already serves as `assigned_employee_id` (references profiles)

### 1B. Create `task_audit_log` table
```text
task_audit_log:
  id          UUID PK default gen_random_uuid()
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
  action      TEXT NOT NULL  -- 'create', 'reassign', 'status_change', 'priority_change', 'due_date_change', 'complete', 'uncomplete'
  field       TEXT           -- which field changed
  old_value   TEXT
  new_value   TEXT
  actor_user_id UUID        -- auth.uid() of who did it
  created_at  TIMESTAMPTZ DEFAULT now()
```

### 1C. RLS Policies
- `task_audit_log`: authenticated users can SELECT (company-scoped via task join) and INSERT
- No changes to existing `tasks` RLS policies

---

## Phase 2: UI Replacement -- `src/pages/Tasks.tsx`

Complete rewrite of this single file. The old agent-based UI is fully replaced.

### Header
- Title: "Employee Tasks"
- Task count
- Refresh button
- "+ New Task" button (opens creation modal)

### Filter Bar
- **Search** input (filters title + description client-side)
- **Status** dropdown: All / Pending / In Progress / Completed
- **Priority** dropdown: All / High / Medium / Low
- **Due Date** dropdown: All / Overdue / Due Today / Due This Week / No Due Date
- **Show Completed** toggle (default OFF)

### Main Table -- Grouped by Employee
- Fetch tasks with joined `profiles` (for assigned employee name) and `profiles` (for created_by name)
- Group tasks by `assigned_to` profile
- Each group has a collapsible header showing: Employee Name + summary chips (Pending count, In Progress count, Overdue count, Completed count)
- Groups with only completed tasks are collapsed by default; others expanded

### Table Columns
| Column | Behavior |
|--------|----------|
| Task | Title + description preview (first line) |
| Status | Inline editable dropdown (Pending/In Progress/Completed) |
| Due Date | Display with overdue highlight (red if past due) |
| Priority | Inline editable dropdown (High/Medium/Low) |
| Assigned To | Inline editable employee dropdown |
| Created By | Read-only name |
| Complete | Checkbox to mark complete/uncomplete |

### Sorting (within each group)
1. Pending + In Progress first (Completed hidden unless toggle ON)
2. Overdue tasks first
3. Then by due_date ascending (nulls last)
4. Then priority: High > Medium > Low
5. Then created_at descending
6. Completed tasks: sorted by completed_at descending

### Row Click -- Details Drawer
- Opens a right-side sheet (not modal) with:
  - Full description (with linkify + copy)
  - All metadata fields
  - Audit log entries (loaded on open, not on page load)
  - Placeholder sections for Comments and Attachments (future)

### New Task Modal
- Title (required)
- Description
- Assign To (required, searchable employee dropdown from profiles)
- Due Date (date picker)
- Priority (default Medium)
- Status defaults to "open" (mapped to Pending in display)
- On create: writes audit log entry with action='create'

### Inline Editing
- Status, Priority, Assigned To changes persist immediately to DB
- Each change writes an audit log record
- Mark Complete sets status='completed', completed_at=now(), logs 'complete'
- Uncomplete clears completed_at, sets status='open', logs 'uncomplete'

---

## Phase 3: Navigation Label Update

Update the label in these files (text only, no structural changes):
- `src/components/layout/AppSidebar.tsx`: "Tasks" to "Employee Tasks"
- `src/components/layout/Sidebar.tsx`: "Tasks" to "Employee Tasks"
- `src/components/layout/MobileNav.tsx`: "Tasks" to "Employee Tasks"
- `src/components/layout/MobileNavV2.tsx`: "Tasks" to "Employee Tasks"
- `src/components/layout/CommandBar.tsx`: "Tasks" to "Employee Tasks"

---

## Performance
- Initial load: fetch tasks with profile joins only (no audit logs)
- Audit log loaded lazily when a task row is clicked open
- No unnecessary re-renders; grouped data memoized

## Status Mapping
- DB stores: `open`, `in_progress`, `completed` (existing values)
- UI displays: `Pending`, `In Progress`, `Completed`
- No schema change needed for status values

## Files Modified
1. `src/pages/Tasks.tsx` -- full rewrite
2. `src/components/layout/AppSidebar.tsx` -- label change only
3. `src/components/layout/Sidebar.tsx` -- label change only
4. `src/components/layout/MobileNav.tsx` -- label change only
5. `src/components/layout/MobileNavV2.tsx` -- label change only
6. `src/components/layout/CommandBar.tsx` -- label change only
7. DB migration: add `created_by_profile_id` column + create `task_audit_log` table + RLS
