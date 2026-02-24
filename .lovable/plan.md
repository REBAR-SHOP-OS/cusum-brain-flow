

## Add Reschedule (Due Date) Functionality to Task Detail Drawer

### Problem
The task detail drawer on `/tasks` shows the due date as static text with no way to change it. Users need to reschedule follow-up tasks directly from the drawer.

### Solution
Make the "Due Date" field in the task detail drawer clickable, opening a date picker (Popover + Calendar) that allows the user to select a new date. On selection, update the task's `due_date` in the database and log the change in the audit trail.

### Technical Details

**File:** `src/pages/Tasks.tsx`

1. **Add imports** for `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent`, and `CalendarDays` icon at the top of the file.

2. **Replace the static Due Date display** (lines 984-987) with an interactive Popover containing a Calendar component:
   - Clicking the due date text opens a calendar popover
   - Selecting a date calls `supabase.from("tasks").update({ due_date, updated_at })` 
   - Writes an audit log entry: `writeAudit(task.id, "reschedule", "due_date", oldDate, newDate)`
   - Updates the local `selectedTask` state and refreshes the task list
   - A small "clear" button allows removing the due date entirely

3. **Permission**: Only the assigned user, creator, or admin can reschedule (reuse the existing `canMarkComplete` check).

The calendar picker will use the existing `Calendar` component from `src/components/ui/calendar.tsx` and `Popover` from `src/components/ui/popover.tsx` -- both already in the project.

### UI Behavior
- The due date cell shows the formatted date (or a "Set date" placeholder) with a small calendar icon
- Clicking opens a popover with the month calendar
- Selecting a date immediately saves and closes the popover
- The audit log records the reschedule action
