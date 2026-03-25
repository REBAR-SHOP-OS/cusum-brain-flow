

## Add Calendar + Enhanced Prompt to Eisenhower Matrix Agent

### What
Two changes to the Eisenhower agent:
1. **Date picker**: Add a calendar (like the Social/Pixel agent already has) so the user selects a date before starting. The selected date is shown on the welcome screen and sent as context to the AI.
2. **Enhanced system prompt**: Update the Eisenhower agent's prompt to follow the structured output format (DO NOW / SCHEDULE / DELEGATE / ELIMINATE + Action Plan).

### Changes

**File: `src/pages/AgentWorkspace.tsx`**

1. Show a calendar popover in the header bar when `agentId === "eisenhower"` (same pattern as the existing `social` calendar at line 693-716)
2. Show the selected date on the welcome/hero screen when `agentId === "eisenhower"` (same pattern as social's date display at line 743-748)
3. Pass `extraContext.selectedDate` when `agentId === "eisenhower"` (add to the extraContext block at line 270-276)
4. Update session title to use `selectedDate` instead of `new Date()` (line 255-256)

**File: `supabase/functions/_shared/agents/growth.ts`**

Replace the Eisenhower system prompt with the full structured prompt:
- Categorize tasks into Q1 (Do Now), Q2 (Schedule), Q3 (Delegate), Q4 (Eliminate)
- Explain why each task belongs in its quadrant
- Generate an Action Plan with: Top 3 priorities, tasks to delegate, tasks to remove/postpone
- Use the exact output format sections: `DO NOW`, `SCHEDULE`, `DELEGATE`, `ELIMINATE`, `Action Plan`
- Instruct the agent to use the `selectedDate` context to understand which date the user is planning for

### Technical Details

- The calendar component (`Calendar` from shadcn) and `Popover` are already imported in AgentWorkspace
- `selectedDate` state already exists (line 88) and is shared across agents
- `handleDateChange` callback already exists for the social agent — reuse it
- The `format` utility from date-fns is already imported
- Edge function `ai-agent` needs redeployment after prompt change

### Files Summary

| File | Change |
|---|---|
| `src/pages/AgentWorkspace.tsx` | Add calendar to header + date display on welcome + pass selectedDate in context for eisenhower |
| `supabase/functions/_shared/agents/growth.ts` | Replace eisenhower prompt with structured matrix format + date awareness |
| Deploy `ai-agent` | Redeploy to pick up new prompt |

