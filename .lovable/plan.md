

## Fix: Task Completion Status Not Updating Across Notification Center and Inbox

### Problem
When a task is marked complete, approved/closed, or reopened on the Tasks page, the corresponding notifications in the Inbox/Notification Center are never dismissed or updated. This means stale "Approve & Close" to-do items and task-related notifications remain visible indefinitely, making it appear that task status changes don't propagate across the app.

### Root Cause
Three functions in `src/pages/Tasks.tsx` modify task or `human_task` status but never touch the related `notifications` rows:

1. **`toggleComplete`** (line 470): Creates a `human_task` (which triggers a notification via DB trigger), but when *reopening* a completed task, it doesn't dismiss the existing approval notification.
2. **`approveAndClose`** (line 524): Resolves the `human_tasks` but does NOT dismiss the corresponding notification that was created by the `notify_human_task` trigger.
3. **`reopenWithIssue`** (line 543): Same as above -- resolves `human_tasks` but leaves notifications untouched.

The `notifications` table has a `metadata` column containing `{ human_task_id: "..." }` (set by the `notify_human_task` trigger), which can be used to find and dismiss the correct notifications.

### Solution

**File: `src/pages/Tasks.tsx`**

Add a helper function `dismissTaskNotifications` that dismisses notifications linked to a specific task's `human_tasks`, then call it from the three affected functions.

| Function | Change |
|---|---|
| New helper: `dismissTaskNotifications(taskId)` | Query `notifications` where `metadata->>'human_task_id'` matches any `human_task` for the given task entity, and update their status to `"dismissed"` |
| `approveAndClose` (line 524) | After resolving `human_tasks`, call `dismissTaskNotifications(task.id)` |
| `reopenWithIssue` (line 543) | After resolving `human_tasks`, call `dismissTaskNotifications(task.id)` |
| `toggleComplete` (line 470) | When reopening (uncompleting), call `dismissTaskNotifications(task.id)` to clear any lingering approval notifications |

### Technical Details

The helper will:
1. Query `human_tasks` to get IDs for the task's entity (`entity_type = 'task'`, `entity_id = taskId`)
2. For each `human_task` ID, update `notifications` where `metadata->>'human_task_id'` matches, setting `status = 'dismissed'`
3. The Realtime subscription in `useNotifications` will automatically pick up these changes and remove the notifications from the Inbox UI

```text
toggleComplete(task)
  |
  +-- (completing) --> creates human_task --> trigger creates notification --> appears in Inbox
  |
  +-- (reopening) --> dismissTaskNotifications(task.id) --> notifications dismissed --> removed from Inbox

approveAndClose(task)
  |
  +-- resolves human_tasks
  +-- dismissTaskNotifications(task.id) --> notifications dismissed --> removed from Inbox

reopenWithIssue(task)
  |
  +-- resolves human_tasks
  +-- dismissTaskNotifications(task.id) --> notifications dismissed --> removed from Inbox
```

### What is NOT Changed
- No database schema or migration changes
- No changes to the `useNotifications` hook (Realtime handles the updates)
- No changes to InboxPanel, Sidebar, TopBar, or any other component
- No changes to any other page or feature

