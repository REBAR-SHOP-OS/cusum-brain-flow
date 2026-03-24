

## Mirror Radin's Feedback Tasks to Zahra's Column

### Problem
Feedback tasks (`source: "screenshot_feedback"`) assigned to Radin only appear in Radin's column. Zahra (delegate) can manage them but has to look in Radin's column. The user wants these feedback tasks to also appear in Zahra's column so she can see and generate fixes from her own view.

### Changes

**File**: `src/pages/Tasks.tsx`

1. **Mirror feedback tasks to Zahra's column** (after line 533, in the task grouping loop):
   - After grouping tasks by employee, iterate through Radin's feedback tasks (`source === "screenshot_feedback"` or `source === "feedback_verification"`)
   - Push copies of those tasks into Zahra's column in `tasksByEmployee`
   - This way Zahra sees all of Radin's feedback tasks directly in her column

2. **No permission changes needed** — the existing `canDeleteOrFix` function already grants Zahra access via `isDelegateFor(task.assigned_to)`, so "Generate Fix", "Delete", "Approve", and "Reopen with Issue" all work for her on Radin's tasks.

### Result
- Zahra sees all feedback tasks in her own column (mirrored from Radin)
- She can open any feedback task and click "Generate Fix"
- Original tasks remain in Radin's column too

| File | Change |
|---|---|
| `src/pages/Tasks.tsx` | Add feedback task mirroring from Radin's column to Zahra's column |

