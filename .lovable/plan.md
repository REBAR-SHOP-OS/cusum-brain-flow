

# Make Newly Created Tasks Visible Immediately

## Root Cause
The task **does exist** in the database (confirmed: ID `f96b00a9`, title "Update CRA Status for All Companies", assigned to Vicky Anderson, due April 10). It is task #16 out of 17 in her column because the sort order puts it near the bottom (sorted by due date, and April 10 is the latest date). The user would need to scroll down in Vicky's column to see it.

## Proposed Fix: Auto-scroll + highlight new tasks

**File: `src/pages/Tasks.tsx`**

1. **Track newly arrived task IDs** — When the realtime subscription fires an INSERT event, capture the new task's ID
2. **Highlight new tasks** — Add a temporary green/cyan border glow animation to tasks that appeared via realtime (fades after 5 seconds)
3. **Show a toast with task info** — When a Vizzy-created task appears, show a toast like "✅ New task: Update CRA Status → Vicky Anderson" so the user knows it arrived

Changes:
- Add state `highlightedTaskIds: Set<string>` that tracks recently inserted task IDs
- In the realtime callback, on INSERT events, add the task ID to the highlight set and show a toast
- In the task card renderer, add a `ring-2 ring-emerald-500 animate-pulse` class for highlighted tasks
- Use `setTimeout` to remove highlight after 5 seconds
- Optionally scroll the column to show the new task using `scrollIntoView`

## Result
- New tasks from Vizzy will be immediately noticeable with a glow effect and toast notification
- No more "where is my task?" confusion

