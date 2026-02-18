
# Fix: Architect Agent Creates Tickets Instead of Actually Fixing

## Problem
The Architect agent, when given a "Fix with ARIA" autofix request, calls `create_fix_ticket` instead of using its write tools (`update_machine_status`, `resolve_task`, etc.) to fix the actual problem. The user sees a response like "I will create a fix ticket to escalate this..." instead of a direct resolution.

## Root Cause
1. The system prompt has a detailed "Fix Ticket System" section (lines 2397-2413) that instructs the agent to use `create_fix_ticket` for any bug report -- this overrides the "Autofix Behavior" section.
2. The `create_fix_ticket` tool description says "Use when diagnosing bugs reported with screenshots or detailed error descriptions" which is too broad -- it matches autofix scenarios too.
3. In the multi-turn loop (line 8271), `create_fix_ticket` is not in the `handledNames` list, so when called inside the loop it gets a fake generic success response and the agent stops.

## Changes (Only in `supabase/functions/ai-agent/index.ts`)

### 1. Update System Prompt -- Autofix Section (lines ~2416-2422)
Make the autofix instruction **stronger and positioned before** the Fix Ticket section. Add explicit rule:
- "When handling an autofix request (message contains 'task_id'), you MUST NOT call `create_fix_ticket`. Instead: `read_task` -> use write tools -> `resolve_task`."
- "Only use `create_fix_ticket` for NEW screenshot-based bug reports that are NOT linked to an existing task."

### 2. Update Fix Ticket System Prompt Section (lines ~2397-2413)
Add a guard clause:
- "If you already have a `task_id`, do NOT create a new fix ticket. Use `read_task` and `resolve_task` instead."

### 3. Add `create_fix_ticket` to Multi-Turn Loop Handlers (line ~8271)
Add `create_fix_ticket`, `update_fix_ticket`, `list_fix_tickets` to the `handledNames` array so they get properly handled in follow-up rounds (they already have handlers in the first-round tool processing at lines 7855-7888).

### 4. Duplicate `create_fix_ticket` Handler Inside Multi-Turn Loop
Add the `create_fix_ticket` handler inside the loop body (around line 8196) so it actually executes if called in a follow-up round, rather than returning a fake generic success.

## No Other Changes
- No frontend changes
- No database changes
- No changes to other agents or pages
