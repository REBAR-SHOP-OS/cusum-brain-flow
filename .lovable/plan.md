

## Add "Schedule Next Activity" to Task Detail Panel

### Problem
The task detail drawer on `/tasks` has no way to schedule follow-up activities. Users need to be able to schedule calls, emails, meetings, or follow-ups directly from a task.

### Solution
Embed the existing `ScheduledActivities` component into the task detail drawer in `src/pages/Tasks.tsx`. This component already provides a full UI for scheduling activities (call, email, meeting, to-do, follow-up) with planned/completed lists -- it just needs to be wired into the task detail panel.

### Changes

**File: `src/pages/Tasks.tsx`**

1. Import the `ScheduledActivities` component at the top of the file
2. Add a "Next Activity" section in the task detail drawer, placed between the action buttons and the audit log
3. Pass `entityType="task"` and `entityId={selectedTask.id}` to the component

The section will include:
- A "Schedule Activity" button that expands into an inline form (activity type, date, note)
- A list of planned activities with "Done" and "Cancel" actions
- A list of completed activities
- All powered by the existing `useScheduledActivities` hook and `scheduled_activities` database table

### What This Reuses
- `ScheduledActivities` component (already built for pipeline/CRM entities)
- `useScheduledActivities` hook (handles CRUD against `scheduled_activities` table)
- `scheduled_activities` table (already exists with `entity_type` + `entity_id` design)

No database changes, no new components, no edge function changes needed.
