

## Fix: Make "Assigned To" Editable on Task Detail

### Problem
The "Assigned To" field in the task detail panel is plain read-only text. Users cannot reassign a task to a different employee.

### Root Cause
In `src/pages/Tasks.tsx` (lines 978-981), the "Assigned To" field renders the employee name as static text with no interactive element:
```tsx
<span className="text-xs text-muted-foreground">Assigned To</span>
<p className="mt-0.5 text-sm">{employees.find(...)?.full_name || "Unassigned"}</p>
```

### Solution
Replace the static text with a `Select` dropdown (same component already imported and used elsewhere in this file). On change, update the task's `assigned_to` in the database, write an audit log entry, and refresh the UI.

### Changes

**File: `src/pages/Tasks.tsx` (lines 978-981)**

Replace the static "Assigned To" display with:

```tsx
<div>
  <span className="text-xs text-muted-foreground">Assigned To</span>
  <Select
    value={selectedTask.assigned_to || ""}
    onValueChange={async (newAssignee) => {
      const oldAssignee = selectedTask.assigned_to;
      if (newAssignee === oldAssignee) return;
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: newAssignee, updated_at: new Date().toISOString() })
        .eq("id", selectedTask.id);
      if (error) { toast.error(error.message); return; }
      const oldName = employees.find(e => e.id === oldAssignee)?.full_name || "Unassigned";
      const newName = employees.find(e => e.id === newAssignee)?.full_name || "Unassigned";
      await writeAudit(selectedTask.id, "reassign", "assigned_to", oldName, newName);
      setSelectedTask({ ...selectedTask, assigned_to: newAssignee });
      loadData();
      toast.success("Task reassigned");
    }}
  >
    <SelectTrigger className="mt-0.5 h-8 text-sm">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {employees.map(emp => (
        <SelectItem key={emp.id} value={emp.id}>
          {emp.full_name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

This follows the exact same pattern used for the "Due Date" field directly below it (inline update, audit log, state refresh).

### What This Does
- Renders a dropdown listing all employees (same `employees` array used throughout the page)
- On selection: updates `assigned_to` in the database, writes an audit trail entry, updates local state, and refreshes the task list
- The task card moves to the new employee's column automatically after reassignment

### What This Does NOT Touch
- No database changes needed
- No new components or hooks
- No edge function changes
- RLS policies already permit updates by admins and creators (per existing `canMarkComplete` logic)

