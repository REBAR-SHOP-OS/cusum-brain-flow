
# Fix: Restrict Task Completion to Assigned User Only

## Problem

In `src/pages/Tasks.tsx`, the `toggleComplete` function and the "Mark Complete" button have **no authorization guard**. Any logged-in user can click the checkbox on any task card or the "Mark Complete" button in the detail drawer and trigger `toggleComplete()`.

The database RLS policy `"Creator or assignee update tasks"` is correctly scoped — it will reject the write if the caller is not the creator, assignee, or admin. However, the UI provides no guard, no visual feedback, and no clear indication of why the action is unavailable. Users see an enabled checkbox that silently fails.

## Root Cause (Two Touch Points)

| Location | Line(s) | Element |
|----------|---------|---------|
| Kanban card (active tasks) | ~742-744 | `<Checkbox onCheckedChange={() => toggleComplete(task)} />` |
| Kanban card (completed tasks) | ~791-794 | `<Checkbox onCheckedChange={() => toggleComplete(task)} />` (un-complete) |
| Detail drawer action button | ~976 | `<Button onClick={() => toggleComplete(selectedTask)}>Mark Complete</Button>` |

## Fix: Add Authorization Guard

### Logic

A user may toggle a task's completion if **any** of the following is true:
- They are the **assigned user** (`currentProfileId === task.assigned_to`)
- They are the **task creator** (`currentProfileId === task.created_by_profile_id`)
- They are an **admin** (determined by the `isInternal` flag already available, or a `hasRole` check)

Since `isInternal` is already computed (user email ends with `@rebar.shop`) and admins are internal, the simplest guard is:

```
canToggle(task) = currentProfileId === task.assigned_to
               || currentProfileId === task.created_by_profile_id
               || isAdmin
```

We already fetch `currentProfileId` and have `isInternal`. We'll use `useUserRole()` hook (already exists in the codebase at `src/hooks/useUserRole.ts`) to get `isAdmin`.

### Changes to `src/pages/Tasks.tsx`

1. **Import `useUserRole`** at the top of the file.

2. **Call `useUserRole()`** inside the component and extract `isAdmin`.

3. **Create a `canToggleTask(task)` helper** using the logic above.

4. **Kanban card checkboxes** (both active and completed):
   - Add `disabled={!canToggleTask(task)}` to the `<Checkbox>` so it's visually grayed out for non-assignees.
   - Wrap with a `title` tooltip: `"Only the assigned user or creator can mark this complete"` when disabled.

5. **Detail drawer "Mark Complete" button**:
   - Add `disabled={!canToggleTask(selectedTask)}` to the button.
   - Show a small helper text below the button when disabled explaining why.

6. **Early return in `toggleComplete`** as a safety backstop:
   ```typescript
   const toggleComplete = async (task: TaskRow) => {
     if (!canToggleTask(task)) {
       toast.error("Only the assigned user or creator can mark this task complete");
       return;
     }
     // ... existing logic
   };
   ```

## Why This Approach

- **Surgical**: Touches only the three UI points + adds one helper function. No other logic, layout, or data fetching changes.
- **Defense in depth**: The RLS backend policy remains the authoritative guard. The frontend guard adds UX clarity (disabled state, tooltip, error toast as backstop).
- **No new DB queries**: `currentProfileId` and `isAdmin` are already available or cheaply derived from the existing `useUserRole` hook.
- **Consistent**: The same `canToggleTask` function is used at all three touch points, so they can't diverge.

## Files Modified

- `src/pages/Tasks.tsx` — import hook, add helper, guard 3 UI points, add backstop in `toggleComplete`
