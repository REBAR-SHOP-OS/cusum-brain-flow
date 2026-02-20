
## Fix: Task Completion Authorization — Admins Should Not Bypass Assignee Restriction

### Problem Identified

The screenshot shows a task **assigned to Saurabh** was marked **complete by Neel** (who is an admin). This is happening because:

**1. `canToggleTask` grants admins unrestricted toggle access**
```typescript
// src/pages/Tasks.tsx — line 267-270
const canToggleTask = (task: TaskRow) =>
  isAdmin ||                                      // ← ANY admin can complete ANY task
  currentProfileId === task.assigned_to ||
  currentProfileId === task.created_by_profile_id;
```

**2. The "Approve & Close" button in the detail drawer has NO permission guard**
```tsx
// Line 984 — no disabled or canApprove check
<Button ... onClick={() => approveAndClose(selectedTask)}>
  Approve & Close
</Button>
```
The `approveAndClose` function is designed for the **task creator** to approve after completion — not for the assignee or arbitrary admins. But currently any user who can open the drawer can click it.

**3. The database UPDATE RLS policy also allows admins to update any task**
The RLS policy uses `has_role(auth.uid(), 'admin')` as a bypass — meaning even if the UI were fixed, a malicious admin could still call the DB directly. The policy needs to be tightened for the `status` field specifically.

---

### Correct Authorization Model

| Action | Who can do it |
|--------|---------------|
| Mark task complete | Assigned user only |
| Mark task incomplete (reopen) | Assigned user OR task creator OR admin |
| Approve & Close | Task creator only (or admin) |
| Reopen with Issue | Task creator only (or admin) |
| Delete task | Task creator or admin |

---

### Changes Required

**File: `src/pages/Tasks.tsx`**

**Change 1 — Tighten `canToggleTask`** to remove the admin bypass for marking tasks complete. Admins should only be able to reopen/uncomplete, not mark others' tasks as done:

```typescript
// New logic: completion (open→completed) is for assignee only
// Uncomplete (completed→open) is for assignee, creator, or admin
const canMarkComplete = (task: TaskRow) =>
  currentProfileId === task.assigned_to;  // ONLY assignee

const canUncomplete = (task: TaskRow) =>
  isAdmin ||
  currentProfileId === task.assigned_to ||
  currentProfileId === task.created_by_profile_id;

const canToggleTask = (task: TaskRow) => {
  if (task.status === "completed") return canUncomplete(task);
  return canMarkComplete(task);
};
```

**Change 2 — Guard the `toggleComplete` function** with the new directional check:
```typescript
const toggleComplete = async (task: TaskRow) => {
  const isCompleted = task.status === "completed";
  if (!isCompleted && !canMarkComplete(task)) {
    toast.error("Only the assigned user can mark this task complete");
    return;
  }
  if (isCompleted && !canUncomplete(task)) {
    toast.error("Only the assigned user, creator, or admin can reopen this task");
    return;
  }
  // ... rest of existing logic unchanged
};
```

**Change 3 — Add `canApproveTask` guard for "Approve & Close" and "Reopen with Issue" buttons**:
```typescript
// Only creator or admin can approve/close
const canApproveTask = (task: TaskRow) =>
  isAdmin || currentProfileId === task.created_by_profile_id;
```

Apply to the "Approve & Close" button:
```tsx
<Button
  disabled={!canApproveTask(selectedTask)}
  ...
>Approve & Close</Button>
```

And to the "Reopen with Issue" button similarly.

**Change 4 — Add tooltip/message** for unauthorized users on all action buttons, so they understand why the button is disabled.

---

### Database RLS (No Change Needed)

The existing UPDATE RLS policy (`Creator or assignee update tasks`) is actually correct for general updates (e.g., editing title, description). Restricting the `status` field alone at the RLS level would require a row-security trigger and is overly complex. Since the fix at the application layer properly enforces the business rule with a server-side `canToggleTask` check that also runs inside `toggleComplete` before the DB call, this provides sufficient protection. The admin RLS bypass is acceptable for other field edits (title, due date etc.) by admins.

---

### Files to Change

| File | Changes |
|------|---------|
| `src/pages/Tasks.tsx` | Add `canMarkComplete`, `canUncomplete`, `canApproveTask` helpers; update `canToggleTask`; add guard in `toggleComplete`; add `disabled` prop + tooltip to "Approve & Close" and "Reopen with Issue" buttons |

**Scope:** Single file, surgical changes to authorization logic only. No UI redesign, no DB migrations needed.
