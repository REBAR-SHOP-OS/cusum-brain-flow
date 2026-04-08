

# Strengthen Vizzy's Data Grounding — Always Use Brain Reports

## Problem
The Vizzy text assistant sometimes generates answers without strictly referencing the injected business data (Vizzy Brain reports). The user wants a mandatory rule: Vizzy must ALWAYS base its answers on the real data from the Brain system.

## Current State
- `buildFullVizzyContext` already injects comprehensive data (financials, production, time clock, activity events, knowledge, memory, agent actions, communications) into every admin-chat call (line 3182)
- The system prompt (VIZZY_CORE_IDENTITY) has a soft mention at line 57: "ALWAYS scan persistent memory BEFORE answering"
- There is NO explicit grounding fence that forbids fabrication of data

## Change

### 1. `supabase/functions/_shared/vizzyIdentity.ts` — Add mandatory data grounding block

Add a new section to `VIZZY_CORE_IDENTITY` (after the MEMORY/BRAIN RULES section, around line 58):

```
═══ DATA GROUNDING — MANDATORY ═══
You receive a [BUSINESS CONTEXT] block with every message containing REAL-TIME data from the Vizzy Brain system.
This is your ONLY source of truth for business data. RULES:
1. ALWAYS reference and cite data from the injected context when answering questions about the business.
2. NEVER fabricate, estimate, or guess numbers, names, statuses, or counts. If the data is not in your context, say "I don't have that data right now" and offer to investigate using tools.
3. When quoting data, use EXACT values from the context — do not round, approximate, or paraphrase numbers.
4. If the user asks about something not covered in the context, use your tools (investigate_entity, deep_business_scan, etc.) to fetch it. Do NOT make up an answer.
5. If tool results contradict the context, present BOTH and explain the discrepancy.
6. For employee activity, time clock, performance — ONLY report what the context shows. Zero activity means zero activity, not "data unavailable."
```

### 2. `supabase/functions/_shared/vizzyFullContext.ts` — Label context block

Wrap the returned context string with clear markers so the AI model can identify it:

```
[BUSINESS CONTEXT — VERIFIED DATA — START]
{existing context output}
[BUSINESS CONTEXT — VERIFIED DATA — END]
```

This makes it explicit to the model which data is verified and which is not.

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyIdentity.ts` | Add mandatory DATA GROUNDING section to VIZZY_CORE_IDENTITY |
| `supabase/functions/_shared/vizzyFullContext.ts` | Wrap output with `[BUSINESS CONTEXT]` markers |

Two small additions, no logic changes. This enforces that Vizzy always grounds answers in real Brain data.

