

# Vizzy Intelligence Trainer — Full Read & Write with CEO Confirmation

## Summary

Upgrade the agent audit system so Vizzy can **read the actual agent prompt source code** (not just chat logs) and **generate precise, surgical Lovable patch commands** for fixes. The CEO's workflow: Vizzy reads everything, analyzes, proposes fixes → CEO says yes/no → CEO pastes the Lovable command to apply. Pixel/social remains untouched.

## What's Missing Today

Currently `vizzy-agent-audit` only reads **chat messages and task logs** — it never sees the actual agent prompt text. This means Vizzy guesses at prompt issues from conversation symptoms. To truly "read and write," Vizzy needs the prompt source code fed into the audit.

## Changes

### 1. Feed Agent Prompt Source Code into Audit (`vizzy-agent-audit/index.ts`)

Import all agent prompt files and include their actual content in the evidence block sent to the AI. This gives Vizzy full visibility into what each agent's instructions say vs how they actually perform.

- Import from `../_shared/agents/sales.ts`, `accounting.ts`, `operations.ts`, `support.ts`, `specialists.ts`, `empire.ts`, `growth.ts`, `marketing.ts`, `purchasing.ts`
- For each active agent, include a `CURRENT PROMPT (first 2000 chars)` section in the evidence
- Skip `social`/`pixel` prompts entirely

### 2. Enhanced AI Audit Prompt — Read + Write Mode

Update the audit system prompt to:
- **READ**: Analyze the actual prompt text alongside conversation logs — find mismatches between what the prompt says and how the agent behaves
- **WRITE**: Generate more precise Lovable commands because Vizzy can now reference exact lines/sections in the prompt that need changing
- Add a new output section: `PROMPT HEALTH CHECK` — does the prompt have clear boundaries, proper tool instructions, anti-hallucination rules, etc.

### 3. Confirm-First Flow in Voice Instructions (`useVizzyVoiceEngine.ts`)

Update the AGENT INTELLIGENCE TRAINER section to make the confirm-first pattern explicit:
- When Vizzy finds an issue and has a fix ready, she says: "I found a problem with the [Agent] — [description]. I have a Lovable fix ready. Want me to show it?"
- CEO says yes → Vizzy outputs the LOVABLE COMMAND block
- CEO says no → Vizzy moves on
- This ensures no fix is presented without CEO approval

### 4. Increase Audit Token Limit

Current `maxTokens: 4000` is too low for reading prompts + generating fixes. Increase to `8000` to accommodate the richer context.

## Technical Details

**Files to modify:**
- `supabase/functions/vizzy-agent-audit/index.ts` — import agent prompts, include in evidence, increase maxTokens, enhance AI prompt for read+write
- `src/hooks/useVizzyVoiceEngine.ts` — update AGENT INTELLIGENCE TRAINER section with confirm-first flow

**Agent prompt imports:**
```typescript
import { salesPrompts } from "../_shared/agents/sales.ts";
import { accountingPrompts } from "../_shared/agents/accounting.ts";
import { operationsPrompts } from "../_shared/agents/operations.ts";
import { supportPrompts } from "../_shared/agents/support.ts";
import { specialistPrompts } from "../_shared/agents/specialists.ts";
import { empirePrompts } from "../_shared/agents/empire.ts";
import { growthPrompts } from "../_shared/agents/growth.ts";
import { marketingPrompts } from "../_shared/agents/marketing.ts";
import { purchasingPrompts } from "../_shared/agents/purchasing.ts";
```

**Evidence format per agent:**
```text
--- SALES (file: agents/sales.ts, sessions: 12, messages: 45) ---
CURRENT PROMPT (first 2000 chars):
[actual prompt text]

RECENT CONVERSATIONS:
[last 10 messages]
```

**Confirm-first voice pattern:**
Vizzy says: "I found an issue with Blitz — he's not flagging stalled leads properly. I have a fix ready. Should I show you the Lovable command?"
CEO: "Yes" → Vizzy outputs the `LOVABLE COMMAND:` block
CEO: "No" / "Skip" → Vizzy moves to next agent

