

## Enable Feedback Completion for Both Radin & Zahra with Mirroring

### Current Behavior
- Feedback tasks (`screenshot_feedback`) are assigned to Radin and mirrored into Zahra's column (same DB record).
- `canMarkComplete` allows Zahra via the delegate system, but the `mirrorFeedbackCompletion` function only handles `feedback_verification` ↔ `screenshot_feedback` pairs — it does not ensure both users' related tasks are marked complete when a plain `screenshot_feedback` task is completed.

### What Needs to Change

**File: `src/pages/Tasks.tsx`**

1. **Ensure `canMarkComplete` explicitly allows both Radin and Zahra for feedback tasks**: Add a check so that for tasks with `source === "screenshot_feedback"` or `source === "feedback_verification"`, both `RADIN_PROFILE_ID` and `ZAHRA_PROFILE_ID` can always mark them complete — regardless of assigned_to or created_by.

2. **Extend `mirrorFeedbackCompletion` for `screenshot_feedback` tasks**: Currently when a `screenshot_feedback` task is completed, the function only marks linked `feedback_verification` tasks as complete. Add logic so that completing a `screenshot_feedback` task also completes any duplicate/mirrored feedback tasks that share the same source and title (if separate records exist). Since mirrored tasks are the same DB record, the main gap is ensuring the `feedback_verification` counterpart is also completed.

### Implementation

**`canMarkComplete` update (around line 361):**
```typescript
const canMarkComplete = (task: TaskRow) => {
  // Both Radin and Zahra can always complete feedback tasks
  const src = (task as any).source;
  if ((src === "screenshot_feedback" || src === "feedback_verification") &&
      currentProfileId && MIRROR_FEEDBACK_PROFILES.includes(currentProfileId)) {
    return true;
  }
  return isAdmin ||
    currentProfileId === task.assigned_to ||
    currentProfileId === task.created_by_profile_id ||
    isDelegateFor(task.assigned_to);
};
```

**Same for `canUncomplete` (around line 368)** — add the same feedback override.

| File | Change |
|---|---|
| `src/pages/Tasks.tsx` | Add explicit feedback task permission for Radin & Zahra in `canMarkComplete` and `canUncomplete` |

