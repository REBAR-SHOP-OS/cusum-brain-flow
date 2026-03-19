

# Vizzy Intelligence Trainer — Agent Auditor & Lovable Patch Generator

## Summary

Add a new capability to Vizzy where she acts as **Intelligence Trainer** for all agents (except Pixel). During the morning pre-digest or on-demand, Vizzy audits each agent's recent performance (chat history, tool usage, QA flags, user satisfaction), identifies weaknesses, and produces:
1. Specific improvement recommendations per agent
2. Special deep-dive on the **Sales agent (Blitz/Commander)** with coaching for Radin
3. For any code-level fix needed: a **ready-to-paste Lovable command** the CEO can copy into Lovable chat

## Changes

### 1. New Edge Function: `vizzy-agent-audit` 

Creates a new backend function that:
- Queries `chat_messages` for recent agent conversations (last 7 days, grouped by agent)
- Queries QA review flags from any stored QA failures
- Queries `human_tasks` for agent-created tasks (quality check)
- Excludes `social` (Pixel) agent from audit
- Sends all data to AI (Gemini 2.5 Pro) with a prompt that evaluates each agent on:
  - Response quality (hallucinations, accuracy, helpfulness)
  - Tool usage efficiency (did they use tools when they should have?)
  - Compliance with their role boundaries
  - Proactiveness (did they create tasks/notifications when they should?)
  - Sales agent gets extra scrutiny: quote accuracy, follow-up suggestions, pipeline coaching quality
- Output format per agent:
  - **Score** (1-10)
  - **Strengths** (what's working)
  - **Weaknesses** (specific issues found)
  - **Recommended Prompt Fix** (if the issue is in the agent's system prompt — output as a Lovable-ready patch command)
  - **Sales Special Report** — detailed coaching notes for Radin on Blitz/Commander improvements

### 2. Lovable Patch Command Generator

When Vizzy finds an agent prompt that needs improvement, she generates a structured Lovable command:

```text
LOVABLE COMMAND:
Fix the [Agent Name] agent prompt in `supabase/functions/_shared/agents/[file].ts`.

PROBLEM: [specific issue found]
FIX: [exact text to add/change in the prompt]
FILE: supabase/functions/_shared/agents/[file].ts
DO NOT TOUCH: [all other files]
```

This gets saved to `vizzy_memory` (category: `agent_audit`) and surfaced in the morning briefing or via voice command "audit the agents."

### 3. Update Pre-Digest (`vizzy-pre-digest/index.ts`)

Add a new section **16. AGENT INTELLIGENCE AUDIT** to the digest prompt:
- Call `vizzy-agent-audit` internally during pre-digest
- Include agent scores and any Lovable patch commands in the morning briefing
- Vizzy tells the CEO: "I audited all agents. Sales needs work — here's a Lovable fix you can paste. Accounting is solid. Support could improve on X."

### 4. Update Voice Instructions (`useVizzyVoiceEngine.ts`)

Add new voice command mapping:
- "Audit the agents" / "Check the agents" / "How are the agents doing?" → triggers agent audit summary
- "Fix [agent name]" → presents the Lovable patch command for that agent
- Special: "How's the sales agent?" → detailed Blitz/Commander audit with coaching notes for Radin

Add new `[VIZZY-ACTION]` type:
```
[VIZZY-ACTION]{"type":"generate_agent_fix","agent":"sales","issue":"..."}[/VIZZY-ACTION]
```
This calls `generate-fix-prompt` with agent-specific context and returns a copy-pasteable Lovable command.

### 5. UI: Lovable Patch Display in Voice Chat (`VizzyVoiceChat.tsx`)

When Vizzy outputs a Lovable patch command in the transcript, detect it and render a **copy button** so the CEO can one-tap copy the command to clipboard and paste into Lovable.

Pattern detection: `LOVABLE COMMAND:` block in transcript → render as a code block with copy button.

## Technical Details

**New file:**
- `supabase/functions/vizzy-agent-audit/index.ts` — agent performance auditor

**Files to modify:**
- `supabase/functions/vizzy-pre-digest/index.ts` — add agent audit section to digest
- `src/hooks/useVizzyVoiceEngine.ts` — add agent audit voice commands + generate_agent_fix action
- `src/components/vizzy/VizzyVoiceChat.tsx` — add Lovable command copy-to-clipboard UI + generate_agent_fix action handler

**Agent file mapping (for patch generation):**
- sales, commander → `agents/sales.ts`
- accounting, collections → `agents/accounting.ts`
- shopfloor, delivery → `agents/operations.ts`
- support, email → `agents/support.ts`
- estimation, legal, data → `agents/specialists.ts`
- empire → `agents/empire.ts`
- growth → `agents/growth.ts`
- social (EXCLUDED from audit) → `agents/marketing.ts`
- eisenhower, bizdev, webbuilder, assistant, copywriting, talent, seo → `agents/growth.ts` or `agents/marketing.ts`
- purchasing →