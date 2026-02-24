

## Fix: Auto-Create Task on Schedule Approval

### Problem
When a Penny collection queue item is edited, assigned, and approved, no corresponding task is created in the assignee's task list on `/tasks`. The approve flow updates the queue item status and triggers execution, but never inserts into the `tasks` table.

### Root Cause
The `approve` function in `src/hooks/usePennyQueue.ts` (line 77-98) and the `penny-execute-action` edge function both lack any logic to create a `tasks` table entry for the assigned user after approval.

### Solution
Add task creation logic to the `penny-execute-action` edge function, immediately after marking the queue item as "executed" (line 133). This is the right place because:
- The edge function already has service-role access to insert into any table
- It knows the final execution status (success/failure)
- It has all the context: customer name, amount, action type, assigned user

### Changes

**File: `supabase/functions/penny-execute-action/index.ts`**

After the queue item is updated to its final status (line 133), add logic to:

1. Check if the queue item has an `assigned_to` profile ID
2. If the execution was successful (`finalStatus === "executed"`), insert a new row into the `tasks` table with:
   - `title`: Descriptive title like "Collection: [Customer Name] - $[Amount]"
   - `description`: Details including action type, days overdue, AI reasoning, and execution result
   - `assigned_to`: The `assigned_to` profile ID from the queue item
   - `due_date`: The `followup_date` from the queue item (if set)
   - `status`: "open"
   - `priority`: Mapped from the queue item priority
   - `company_id`: From the queue item
   - `source`: "penny" (to identify auto-generated tasks)
   - `source_ref`: The queue item ID (linking back to the origin)
   - `created_by_profile_id`: The approver's profile ID (looked up from `userId`)

### Technical Details

| File | Change |
|------|--------|
| `penny-execute-action/index.ts` | After line 133 (post-status-update), add ~20 lines to insert into `tasks` table when `finalStatus === "executed"` and `action.assigned_to` is set |

The task will appear on the `/tasks` page for the assigned user immediately after approval, with full context about the collection action.

If no user is assigned (`assigned_to` is null), no task will be created -- this preserves backward compatibility for unassigned queue items.
