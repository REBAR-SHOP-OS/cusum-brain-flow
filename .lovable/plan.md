

# Unify Vizzy Identity — Implementation Plan

## What We're Building

A single shared identity module (`vizzyIdentity.ts`) that becomes the source of truth for Vizzy's personality across all 5 surfaces. Every surface imports from this module (edge functions) or mirrors it (frontend voice).

## File Changes

### 1. NEW: `supabase/functions/_shared/vizzyIdentity.ts`

Four exports built from the user's executive assistant directive:

- **`VIZZY_CORE_IDENTITY`** (~2,500 chars) — The full CEO executive partner prompt compressed into sections: Core Identity, Primary Objectives (think clearly, diagnose, organize, manage execution, protect decisions, bird's-eye view), 4-Layer Operating Mode, Communication Style, Business Problem-Solving Protocol (5-step: clarify → root cause → structure → options → approval), Intelligence Standard, Memory/Brain Rules, Approval Rules, Task Management, Employee Follow-Up, Summarization, Bird's-Eye Oversight, Brainstorming, Daily Behavior Style, Relationship Dynamic, Initiative Rules, Emotional Posture, Discipline Rules.

- **`VIZZY_VOICE_ADDENDUM`** (~800 chars) — Turn-taking, background noise ignore, voice format (under 30s, punchy), employee fuzzy matching directory (Neel/Vicky/Sattar/etc with phonetic variants), VIZZY-ACTION tag syntax, sync awareness, per-person daily reports section.

- **`VIZZY_TOOL_ADDENDUM`** (~1,200 chars) — Extracted from current admin-chat lines 2540-2649: tool usage rules, self-awareness inventory (CAN/CANNOT lists), deep investigation protocol, data refresh rule, banned phrases, image analysis, ERP action suite, authorization & data access rules.

- **`VIZZY_BRIEFING_ADDENDUM`** (~600 chars) — Briefing-specific: severity ranking format, anti-hallucination rules, number preservation rules, [FACTS] block handling. Keeps daily brief format instructions separate from identity.

- **`VIZZY_HELP_ADDENDUM`** (~400 chars) — Lightweight: "I'm Vizzy — your guide to REBAR SHOP OS. For business intelligence, open the Admin Console." Plus existing app modules knowledge (dashboard, shop floor, pipeline, customers, etc.) from current `app-help-chat`.

### 2. `supabase/functions/admin-chat/index.ts`

- Import `VIZZY_CORE_IDENTITY` and `VIZZY_TOOL_ADDENDUM` from shared module
- Replace lines 2439-2649 (the inline systemPrompt string) with:
  ```ts
  const systemPrompt = VIZZY_CORE_IDENTITY + "\n\n" + VIZZY_TOOL_ADDENDUM + "\n\n" + pageContext + "\n\n" + systemContext;
  ```
- Replace "JARVIS" with "Vizzy" in comment on line 2651
- Keep ALL tool definitions, SSE streaming, data injection, image handling unchanged

### 3. `src/hooks/useVizzyVoiceEngine.ts`

- Replace the inline `VIZZY_INSTRUCTIONS` const (lines 16-183) with a restructured version that mirrors `VIZZY_CORE_IDENTITY` + voice addendum
- Same personality, same rules, same banned phrases, same intelligence standard — formatted for spoken responses
- Cannot import from edge functions (Deno vs Vite), so this is a mirrored copy with a comment pointing to the source of truth
- Keep all existing mechanics: VIZZY-ACTION tags, buildInstructions(), ERP data injection, session flow

### 4. `supabase/functions/vizzy-daily-brief/index.ts`

- Import `VIZZY_BRIEFING_ADDENDUM` from shared module
- Replace "JARVIS — Executive Intelligence Briefing System" with "Vizzy — Executive Intelligence Briefing"
- Replace greeting line from "Good [time], boss." to "Good [time], boss." (stays same — just remove JARVIS framing)
- Keep all briefing-specific format instructions, anti-hallucination rules, number preservation

### 5. `supabase/functions/app-help-chat/index.ts`

- Import `VIZZY_HELP_ADDENDUM` from shared module
- Replace the entire `SYSTEM_PROMPT` const with the imported addendum
- Identity becomes: Vizzy as app navigator, redirects business questions to Admin Console
- Keep lightweight — no business data, no tools

### 6. `supabase/functions/_shared/agents/operations.ts`

- Rewrite `assistant` prompt (lines 159-327):
  - Remove ARIA hierarchy framing (chain-of-command ASCII, governance structure, escalation protocol)
  - Reframe from "Ops Commander in ARIA platform" to "Vizzy — CEO's executive assistant with full operational access"
  - Keep: full data access section, email reading tools, RingCentral tools, agent registry table, proactive risk detection, team directory
  - Remove: governance/ARIA sections (~60 lines), enforcement rules about ARIA approval

### 7. `src/components/layout/IntelligencePanel.tsx`

- Rename header text from "Admin Console" to "Vizzy"
- Replace `Wrench` icon import with `Sparkles` from lucide-react
- Update empty-state: "Vizzy" title, "Your executive intelligence assistant" subtitle
- Update placeholder suggestions to match executive partner framing
- Keep all chat, streaming, delete, clear functionality unchanged

### 8. `src/components/help/HelpPanel.tsx`

- Update empty-state heading to "Vizzy" instead of generic help
- Update subtitle to "Ask me anything about using the app"
- Replace `HelpCircle` icon in header with `Sparkles` for consistency
- Keep all chat functionality, quick actions, tour restart unchanged

## What Does NOT Change
- All tool definitions and execution logic in `admin-chat`
- SSE streaming, tool confirmation flow, browser actions
- Voice engine mechanics (OpenAI Realtime API, audio handling)
- Database schema, RLS policies
- Edge function routing and auth
- Super admin access gating (sattar/radin only)
- Nila (separate assistant)

## Impact
- 8 files (1 new, 7 updated)
- Single personality across all surfaces
- Future prompt changes in ONE place (edge functions) or TWO (voice mirror)
- No database, auth, or routing changes

