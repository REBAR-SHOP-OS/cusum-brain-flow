

## Grant Zahra Access to Manage Radin's Tasks

### What
Allow `zahra@rebar.shop` to perform all actions on `radin@rebar.shop`'s tasks — mark complete, uncomplete, approve, delete, generate fix, and reassign. Currently only the assigned user, task creator, or admin can do these actions.

### How
Add a "delegate access" concept: Zahra is treated as having the same permissions as Radin on his tasks.

**File**: `src/pages/Tasks.tsx`

1. **Add a delegate map** after the constants (~line 117):
   ```typescript
   // Delegate access: key = profile who gains access, value = profiles they can manage
   const TASK_DELEGATES: Record<string, string[]> = {
     [ZAHRA_PROFILE_ID]: [RADIN_PROFILE_ID],
   };
   ```

2. **Create a helper** to check if user is a delegate:
   ```typescript
   const isDelegateFor = (taskAssignedTo: string | null) => {
     if (!currentProfileId || !taskAssignedTo) return false;
     return TASK_DELEGATES[currentProfileId]?.includes(taskAssignedTo) ?? false;
   };
   ```

3. **Update all permission checks** to include delegate access:
   - `canMarkComplete` — add `|| isDelegateFor(task.assigned_to)`
   - `canUncomplete` — add `|| isDelegateFor(task.assigned_to)`
   - `canApproveTask` — add `|| isDelegateFor(task.assigned_to)`
   - `canDeleteOrFix` — add `|| isDelegateFor(task.assigned_to)`

This gives Zahra full control over Radin's task column without granting admin role.

### Files Changed

| File | Change |
|---|---|
| `src/pages/Tasks.tsx` | Add delegate map + update 4 permission functions to include delegate access |

