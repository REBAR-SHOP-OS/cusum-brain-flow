

# Fix: Tasks Page -- Make Tasks Openable + Add "Fix with ARIA" Button

## Problems Identified

1. **Tasks are NOT opening** -- Each task row in `src/pages/Tasks.tsx` is a plain `<div>` with no click handler and no detail dialog. Clicking a task does nothing.
2. **No "Fix with ARIA" option** -- There is no way to send a task to the Architect agent for automated fixing/resolution.

## Solution (Single file: `src/pages/Tasks.tsx`)

### 1. Task Detail Dialog

Add a click handler on each task row that opens a full detail dialog showing:

- Title, description, priority, agent type, status, due date, source
- Attachment URL (if any)
- Created/completed timestamps
- Editable status dropdown inside the dialog

The dialog reuses the existing `Dialog` component from Radix. Clicking the task row opens the dialog; clicking the checkbox still toggles completion without opening it (via `e.stopPropagation()`).

### 2. "Fix with ARIA" Button on Every Task

Inside the task detail dialog AND as an inline button on each task row:

- A "Fix with ARIA" button that:
  - Summarizes the task into a compact payload: `"[Task] Title | Priority: high | Agent: sales | Description: ..."`
  - Navigates to `/empire?autofix=<encoded_summary>` (same pattern as `SmartErrorBoundary`)
  - The Architect agent receives the task context and can act on it

This follows the exact same pattern already used in `SmartErrorBoundary.tsx` (line 224):
```
window.location.href = `/empire?autofix=${payload}`;
```

### 3. Visual Changes

- Task rows get `cursor-pointer` for click affordance
- "Fix with ARIA" button uses the same orange-to-red gradient style from SmartErrorBoundary
- The dialog shows the full task detail with all fields

## Technical Details

### File: `src/pages/Tasks.tsx`

**New state:**
- `selectedTask: Task | null` -- which task is open in the dialog
- `dialogOpen: boolean` -- controls dialog visibility

**New imports:**
- `Dialog, DialogContent, DialogHeader, DialogTitle` from `@/components/ui/dialog`
- `Sparkles` from `lucide-react`

**Row click handler:**
```
onClick={() => { setSelectedTask(task); setDialogOpen(true); }}
```

**Checkbox stopPropagation** -- prevents opening dialog when toggling completion.

**"Fix with ARIA" function:**
```typescript
const fixWithAria = (task: Task) => {
  const summary = [
    `[Task] ${task.title}`,
    task.priority ? `Priority: ${task.priority}` : null,
    task.agent_type ? `Agent: ${task.agent_type}` : null,
    task.description ? `Description: ${task.description.slice(0, 300)}` : null,
    task.source ? `Source: ${task.source}` : null,
    task.due_date ? `Due: ${task.due_date}` : null,
  ].filter(Boolean).join(" | ");
  
  window.location.href = `/empire?autofix=${encodeURIComponent(summary)}`;
};
```

**Inline button on each task row** (right side, next to status dropdown):
- Small Sparkles icon button
- Tooltip: "Fix with ARIA"

**Dialog footer:**
- Full "Fix with ARIA" button with gradient styling
- Status change dropdown
- Close button

No new files, no new dependencies, no database changes.
