

# Add "Auto Fix" Button to Task Detail Drawer

## What This Does
Adds a working "Auto Fix with ARIA" button in the task detail drawer (next to "Mark Complete" and "Delete"). When clicked, it navigates to the Architect agent (`/empire`) with the task's context pre-loaded, triggering ARIA's automated fix pipeline.

## How It Works

The system already has this exact pipeline built:
1. `SmartErrorBoundary` already redirects to `/empire?autofix=...&task_id=...`
2. `EmpireBuilder.tsx` already picks up those query params and auto-sends a fix request to the AI agent
3. The AI agent already has tools to read tasks, apply fixes, and resolve tasks

The only missing piece is the button in the task drawer.

## Changes

### File: `src/pages/Tasks.tsx`

1. **Add import**: Import `Sparkles` icon from `lucide-react` and `useNavigate` from `react-router-dom`

2. **Add "Auto Fix" button** in the Actions section (line ~600), between "Mark Complete" and "Delete":
   - Orange gradient button with Sparkles icon, labeled "Auto Fix"
   - On click: navigates to `/empire?autofix=<encoded task description>&task_id=<task id>`
   - This triggers the existing autofix flow in EmpireBuilder

3. **Button logic**:
   - Constructs an error/problem description from the task title + description
   - URL-encodes it and navigates to the Architect agent
   - The Architect agent automatically picks it up, reads the task, attempts fixes using its write tools, and marks the task resolved

## No Changes To
- EmpireBuilder page (already handles autofix params)
- SmartErrorBoundary (unchanged)
- Database schema, RLS, or any other component
- Any styling or layout outside the task drawer actions row

## Technical Detail

The button click handler:
```
const desc = `${selectedTask.title}\n\n${selectedTask.description || ""}`;
const payload = encodeURIComponent(desc.slice(0, 500));
navigate(`/empire?autofix=${payload}&task_id=${selectedTask.id}`);
```

This reuses the exact same query-param contract that `SmartErrorBoundary` already uses, ensuring the Architect agent processes it identically.
