
# Post-Completion Approval Flow for Tasks

## Problem
When a task is marked complete, there is no notification or approval step for the task owner (the person who created the task). The owner should be able to review, approve/close the ticket, or reject and reschedule a new fix with evidence.

## Solution
Modify the `toggleComplete` function in `src/pages/Tasks.tsx` to automatically create a `human_tasks` entry for the task creator when a task is marked complete. Also add an "Approve & Close" vs "Reopen with Issue" flow in the task drawer for completed tasks.

## Changes

### 1. `toggleComplete` in `src/pages/Tasks.tsx` -- Create approval activity on completion

When a task moves to "completed":
- Look up the task's `created_by_profile_id` (the task owner/creator)
- Find or use a default agent to associate the human_task with
- Insert a `human_tasks` row with:
  - `title`: "Approve & Close: [task title]"
  - `description`: "Task has been marked complete. Review the work and either approve to close or reopen with new evidence."
  - `severity`: "info"
  - `category`: "task_approval"
  - `entity_type`: "task"
  - `entity_id`: the task's ID
  - `assigned_to`: `created_by_profile_id` (the task owner)
  - `status`: "open"
  - `company_id`: from the task

### 2. Task Drawer -- Add approval UI for completed tasks

In the task detail drawer (around line 800), when a task is "completed", replace the "Mark Incomplete" button with two options:
- **"Approve & Close"** (green) -- marks the task as "closed" or keeps "completed" and dismisses the human_task
- **"Reopen with Issue"** (orange) -- reopens the task to "open", prompts for a comment describing the problem (new evidence), and optionally allows attaching a screenshot

### 3. Status handling

Add a new conceptual status or keep using existing statuses:
- "completed" = work done, pending approval
- When approved: stays "completed" (or add "closed" if desired) and the human_task is resolved
- When rejected: status reverts to "open" with a comment added automatically

## Technical Details

**File: `src/pages/Tasks.tsx`**

1. In `toggleComplete` (line 377-392), after successfully marking complete, insert into `human_tasks`:
```tsx
if (!isCompleted && task.created_by_profile_id) {
  // Find an agent for context (use a general/vizzy agent)
  const { data: agent } = await supabase
    .from("agents" as any)
    .select("id")
    .eq("code", "vizzy")
    .single();
  
  if (agent) {
    await supabase.from("human_tasks" as any).insert({
      agent_id: (agent as any).id,
      company_id: task.company_id,
      title: `Approve & Close: ${task.title}`,
      description: `Task completed. Review and approve to close, or reopen with new evidence.`,
      severity: "info",
      category: "task_approval",
      entity_type: "task",
      entity_id: task.id,
      assigned_to: task.created_by_profile_id,
      status: "open",
    });
  }
}
```

2. In the task drawer actions section (line 800-818), add conditional UI:
- For completed tasks: show "Approve & Close" and "Reopen with Issue" buttons
- "Reopen with Issue" opens a small dialog/input for the user to describe what's wrong (this becomes a new comment on the task)
- On reopen: update task status to "open", add the comment, write audit log, and the user can then use "Auto Fix" again with new evidence

## Files Changed

| File | Change |
|---|---|
| `src/pages/Tasks.tsx` | Add human_task creation on completion; add Approve/Reopen UI in drawer for completed tasks |

## Flow

1. User clicks "Mark Complete" on a task
2. Task moves to "completed" status
3. A `human_tasks` entry is automatically created for the task creator
4. Task creator sees the approval notification
5. Creator opens the task and either:
   - Clicks "Approve & Close" -- task stays completed, human_task resolved
   - Clicks "Reopen with Issue" -- enters a description of the problem, task reopens to "open", they can attach new evidence and use Auto Fix again
