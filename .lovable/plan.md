

## Fix: "Reopen with Issue" on Feedback Tasks Should Re-assign to Developer

### Problem
When a feedback task (source = "screenshot_feedback") is completed and the creator clicks "Reopen with Issue", the current `reopenWithIssue` function just sets the task status back to "open". But for feedback tasks specifically, the expected behavior is: the feedback should be re-created as a **new high-priority task** for the developer (FEEDBACK_RECIPIENTS = Radin), including the issue reason — same as what `reReportFeedback` does, but with the additional "reason" text from the dialog.

Currently `reopenWithIssue` is generic — it doesn't distinguish between regular tasks and feedback tasks.

### Plan

**File: `src/pages/Tasks.tsx`** — Update `reopenWithIssue` (lines 745-787)

Add a feedback-specific branch: when the task has `source === "screenshot_feedback"`, instead of just reopening the same task:

1. **Create new task(s)** for each FEEDBACK_RECIPIENT with:
   - Title: `🔄 مشکل حل نشده: {original_title}`
   - Description: original description + the reopen reason
   - Priority: high
   - Source: "screenshot_feedback"
   - Include the original attachment_url
   - `created_by_profile_id` = current user (the reporter)

2. **Mark the current task as completed** (or keep it completed) — don't reopen it

3. **Send notification** to the assignee about the re-reported issue

4. For **non-feedback tasks**, keep the existing behavior (reopen with status "open")

```text
Before:
  reopenWithIssue(feedbackTask) → status="open" on same task → confusing

After:
  reopenWithIssue(feedbackTask) → new task for FEEDBACK_RECIPIENTS with reason
                                → original task stays completed
                                → same flow as reReportFeedback but with reason text
```

This is essentially merging the `reReportFeedback` logic into the `reopenWithIssue` function when the task source is "screenshot_feedback".

