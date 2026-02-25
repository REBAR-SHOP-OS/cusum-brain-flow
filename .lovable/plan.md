
## Feedback Resolution Notification with Confirm/Re-report Actions

### What This Does
When Radin or Sattar click "Approve & Close" on a screenshot feedback task, the system will:
1. Send a notification to the original bug reporter in their Inbox
2. The notification will have two action buttons:
   - **Confirm Fixed (checkmark)** -- closes/dismisses the notification, confirming the fix worked
   - **Still Broken (re-report)** -- creates a new task assigned to Radin with the original feedback details, so the issue gets re-investigated

### Implementation Steps

**Step 1: Modify `approveAndClose` in `src/pages/Tasks.tsx`**

After the existing approval logic, add code to detect if the task is a `screenshot_feedback` task (by checking `task.source`). If so:
- Look up the original reporter's `user_id` from `task.created_by_profile_id`
- Insert a notification for that user with:
  - `type: "notification"`
  - `title: "Your feedback was resolved"` (with the task title)
  - `agent_name: "Feedback"`
  - `metadata: { task_id: task.id, feedback_resolved: true, original_title: task.title, original_description: task.description, original_attachment_url: task.attachment_url }`
  - `link_to: null` (so it expands inline instead of navigating away)

**Step 2: Enhance the `NotificationItem` component in `src/components/panels/InboxPanel.tsx`**

For notifications that have `metadata.feedback_resolved === true`, render two action buttons instead of the default behavior:

- A green checkmark button (CheckCircle icon) -- confirms the fix. Clicking it calls `dismiss(id)` to close the notification.
- A red refresh/re-report button (RotateCcw icon) -- re-reports the issue. Clicking it:
  1. Creates a new task in the `tasks` table assigned to Radin (`RADIN_PROFILE_ID`) with the original feedback details from `metadata`
  2. Dismisses the notification
  3. Shows a toast confirming re-submission

**Step 3: Add the re-report handler in `InboxPanel.tsx`**

Create a `handleReReport` function that:
- Reads `metadata.original_title`, `metadata.original_description`, `metadata.original_attachment_url` from the notification
- Inserts a new task with `source: "screenshot_feedback"`, `assigned_to: RADIN_PROFILE_ID`, status `pending`, priority `high`
- Gets the current user's `company_id` and `profile_id` for the new task
- Dismisses the original notification
- Shows a success toast

### Technical Details

**Constants needed:**
```
RADIN_PROFILE_ID = "5d948a66-619b-4ee1-b5e3-063194db7171"
```

**Notification metadata schema for feedback resolution:**
```typescript
{
  task_id: string;
  feedback_resolved: true;
  original_title: string;
  original_description: string;
  original_attachment_url: string | null;
}
```

**Files to modify:**
1. `src/pages/Tasks.tsx` -- Add notification creation in `approveAndClose` for feedback tasks
2. `src/components/panels/InboxPanel.tsx` -- Add confirm/re-report action buttons for feedback resolution notifications

**No database changes needed** -- uses the existing `notifications` and `tasks` tables.
