

# Make "Fix with ARIA" Actually Fix Problems

## Problem
Currently, clicking "Fix with ARIA" on the Tasks page only redirects to the Empire Builder chat with a message. The Architect agent creates fix tickets and generates fix prompts, but never actually resolves the original task or applies real fixes to ERP/QuickBooks/Odoo data. The user wants the system to take real action, not just report.

---

## Changes

### 1. Add `resolve_task` Tool to Empire Agent (ai-agent/index.ts -- empire section only)

**New tool definition** that allows the Architect to:
- Read the original task from the `tasks` table by ID
- Apply the fix using existing ERP write tools (update_machine_status, update_delivery_status, update_lead_status, etc.)
- Mark the original task as `completed` with a resolution note
- Log the resolution in `activity_events`

**Tool parameters:**
- `task_id` (string, required) -- the original task UUID
- `resolution_note` (string, required) -- what was done to fix it
- `new_status` (string, default "completed") -- new task status

### 2. Add `read_task` Tool to Empire Agent (ai-agent/index.ts -- empire section only)

Allows the Architect to fetch the full task details (title, description, source, priority) so it can understand what needs fixing before acting.

### 3. Update Empire System Prompt (ai-agent/index.ts -- empire section only)

Update the system prompt to instruct the Architect:
- When receiving an autofix request, first use `read_task` to understand the problem
- Then use existing ERP/WP/Odoo write tools to apply the actual fix
- Then use `resolve_task` to mark the task as completed with a resolution note
- Remove the "READ-ONLY" restriction for QB/Odoo -- the Architect has write tools and should use them
- Add explicit instruction: "Do NOT just create fix requests or tickets. Use your write tools to fix the problem directly."

### 4. Improve Autofix Flow in Tasks Page (src/pages/Tasks.tsx)

Change `fixWithAria` to:
- Include the `task.id` in the autofix payload so the Architect can reference and resolve it
- After redirect, pass `task_id` as a separate query param so the agent can call `resolve_task` with it
- Add a toast notification "Sending to Architect for resolution..."

### 5. Update Empire Autofix Handler (src/pages/EmpireBuilder.tsx)

Update the autofix useEffect to:
- Extract `task_id` from query params
- Include `task_id` in the auto-message sent to the Architect so it knows which task to resolve
- After the Architect responds, check if the task was resolved and show a confirmation

---

## What This Fixes
- "Fix with ARIA" will actually diagnose and apply fixes using existing ERP/WP write tools
- The original task will be marked as "completed" with a resolution note
- The Architect will stop creating tickets about tickets and instead take action
- QuickBooks/Odoo write operations remain controlled through existing tools (wp_update_product, update_machine_status, etc.)

## Files Modified
1. `supabase/functions/ai-agent/index.ts` -- Empire section only (add tools + update prompt)
2. `src/pages/Tasks.tsx` -- Update `fixWithAria` function
3. `src/pages/EmpireBuilder.tsx` -- Update autofix handler

## Files NOT Modified
- No other pages, components, or modules
- No database changes needed (tasks table already exists)
- No changes to auth, routing, or other agents
