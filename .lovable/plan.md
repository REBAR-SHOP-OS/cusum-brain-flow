

# Train All Agents with Ontario Rules + Agent Activity Report in Daily Summary

## Overview

Two changes: (1) inject Ontario regulatory context into all 15 agent system prompts so every agent operates with awareness of Ontario laws and acts as a CEO helper, and (2) add an "Agent Activity Report" section to the daily summary showing what each AI agent and human did that day.

---

## Change 1: Ontario Context for All Agents

**File:** `supabase/functions/ai-agent/index.ts`

Add a new constant `ONTARIO_CONTEXT` (after the existing `SHARED_TOOL_INSTRUCTIONS` at line 625) containing:

- **ESA (Employment Standards Act):** 44h/week OT threshold, 1.5x rate, 30min meal break after 5h, 2 weeks vacation after 12 months, 9 statutory holidays
- **OHSA / WSIB:** Critical injury reporting within 48h, JHSC required for 20+ workers, WHMIS training, WSIB premiums
- **Construction Lien Act:** 60-day preservation window, 10% holdback on progress payments, Prompt Payment Act 28-day cycle
- **CRA / HST:** 13% HST on Ontario sales, quarterly remittance, T4 deadlines
- **CEO Helper Mode directive:** All agents proactively flag compliance risks, create tasks for regulatory deadlines, report exceptions

Then prepend `ONTARIO_CONTEXT` to every agent prompt in the `agentPrompts` record (all 15 agents: sales, accounting, support, collections, estimation, social, bizdev, webbuilder, assistant, copywriting, talent, seo, growth, legal, eisenhower).

This is done by modifying the prompt construction logic (around line 1376 where prompts are used) to concatenate `ONTARIO_CONTEXT` before each agent's specific prompt, similar to how `SHARED_TOOL_INSTRUCTIONS` is already appended.

---

## Change 2: Agent Activity Report in Daily Summary

### Backend: `supabase/functions/daily-summary/index.ts`

**Data context addition (around line 873):** Add a new section `--- AGENT ACTIVITY REPORT ---` that groups `command_log` entries by:
- Agent type (parsed from `parsed_intent` field) -- count interactions per agent
- User ID (resolved to name via `profileMap`) -- count commands per human

**AI prompt addition (around line 908):** Add `agentActivityReport` to the JSON schema the AI must return:

```text
"agentActivityReport": {
  "totalInteractions": "number",
  "agentBreakdown": [
    { "agent": "Name", "interactions": 3, "tasksCreated": 2, "highlights": ["..."] }
  ],
  "humanActivity": [
    { "name": "Employee", "agentsUsed": ["penny","blitz"], "totalCommands": 5, "highlights": ["..."] }
  ]
}
```

**Stats addition:** Add `agentInteractions` count to the stats object returned.

### Frontend Types: `src/hooks/useDailyDigest.ts`

Add two new interfaces:

```text
DigestAgentActivity { agent, interactions, tasksCreated, highlights[] }
DigestHumanActivity { name, agentsUsed[], totalCommands, highlights[] }
```

Add to `DigestData`:
```text
agentActivityReport?: { totalInteractions, agentBreakdown[], humanActivity[] }
```

### Frontend UI: `src/components/daily-digest/DigestContent.tsx`

Add a new "Agent Activity Report" card (after the ERP Activity card, before Emails) that renders:
- Total AI interactions pill
- Each agent's name, interaction count, and highlights
- Each human's name, agents used, and what they accomplished
- Styled consistently with existing digest cards using the same Card/CardContent pattern

---

## Files Modified

| File | What Changes |
|------|-------------|
| `supabase/functions/ai-agent/index.ts` | Add `ONTARIO_CONTEXT`, prepend to all 15 agent prompts |
| `supabase/functions/daily-summary/index.ts` | Group command_log by agent/user, add agentActivityReport to AI schema |
| `src/hooks/useDailyDigest.ts` | Add agent/human activity types to DigestData |
| `src/components/daily-digest/DigestContent.tsx` | Render Agent Activity Report card |

## Implementation Order

1. Add `ONTARIO_CONTEXT` to ai-agent and prepend to all prompts
2. Update daily-summary data context + AI prompt schema
3. Update frontend types and DigestContent rendering
4. Deploy both edge functions

