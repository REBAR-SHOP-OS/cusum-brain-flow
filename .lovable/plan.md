

## Mirror Feedback Task Completion Between Zahra & Radin

### Problem
Feedback tasks (`screenshot_feedback` and `feedback_verification`) are visually mirrored between Zahra and Radin's columns, but completing one doesn't auto-complete the paired task. When either user checks off a feedback task, the linked task should also be marked complete.

### Changes

**File**: `src/pages/Tasks.tsx`

Add a helper function `mirrorFeedbackCompletion(task)` called after successful completion in three places:

1. **`toggleComplete`** (line ~611, after successful update): If the task source is `screenshot_feedback` or `feedback_verification`, and the acting user is Zahra or Radin, find and complete the paired task.

2. **`confirmFeedbackFix`** (line ~678): Same — after confirming, auto-complete the linked original task.

3. **`approveAndClose`** (line ~719): Same pattern.

**Mirror logic**:
- If a `feedback_verification` task is completed → find the original `screenshot_feedback` task via `metadata.original_task_id` → mark it completed
- If a `screenshot_feedback` task is completed → find any `feedback_verification` task where `metadata->>'original_task_id'` equals this task's ID → mark it completed
- Only triggers when the acting user's profile is Zahra or Radin

| File | Change |
|---|---|
| `src/pages/Tasks.tsx` | Add `mirrorFeedbackCompletion` helper, call it in `toggleComplete`, `confirmFeedbackFix`, and `approveAndClose` |

