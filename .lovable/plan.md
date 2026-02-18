

# Improve Auto Fix: Real Problem Resolution + Success Feedback

## Problem
When "Auto Fix" is triggered from Tasks, the Architect agent says "I cannot fix it directly, I will create a fix request" instead of actually attempting to fix or asking clarifying questions. Also, there's no visual success confirmation (green badge) when a fix is completed.

## Root Causes
1. The agent's system prompt tells it to use "ERP/WP/Odoo write tools" but many tasks (like client-side bugs) don't have matching write tools -- the agent gives up and creates a fix request
2. The autofix trigger message doesn't instruct the agent to ask the user questions when it can't auto-fix
3. No visual feedback in the chat when `resolve_task` succeeds

## Changes (3 files only)

### 1. Edge Function: Stronger Autofix Instructions
**File: `supabase/functions/ai-agent/index.ts`**

Update the CRITICAL Autofix Behavior section (~line 2397) to add a clear fallback protocol:

- When the agent has write tools that match the problem: use them directly
- When it CANNOT fix automatically (e.g., code bugs, UI issues): it MUST ask the user clarifying questions and provide step-by-step actionable instructions -- NOT just create a fix request
- Only create a fix request as absolute last resort after exhausting questions
- When `resolve_task` succeeds, the agent must include a `[FIX_CONFIRMED]` marker in its response

### 2. Frontend: Autofix Trigger Message Enhancement
**File: `src/pages/EmpireBuilder.tsx`**

Update the autofix message (~line 172) to be more explicit:

```
"If you CANNOT fix it with your tools, do NOT create a fix request.
Instead: (1) Ask the user clarifying questions, (2) Provide specific
actionable steps the user can follow, (3) Only use resolve_task when
the problem is actually fixed."
```

### 3. Frontend: Green Success Confirmation in Chat
**File: `src/pages/EmpireBuilder.tsx`**

In the message rendering section, detect `[FIX_CONFIRMED]` in agent responses and display a green success banner:

- Green gradient card with checkmark icon
- Text: "Fix completed successfully"
- Strip the marker from the displayed text
- This gives clear visual confirmation that the fix was applied

## No Changes To
- Tasks page (Auto Fix button is already working correctly)
- Database schema, RLS, or any other component
- Any other agent or edge function

