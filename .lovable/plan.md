

# Safe Cleanup of Deprecated Agents: collections, Chase, commander, estimation

## Summary of Findings

**Agents to remove:**
- `collections` / "Chase" — merged into Penny (accounting). Collections functionality is already handled by Penny's prompt.
- `commander` / "Commander" — standalone sales manager agent. Has its own prompt, context, suggestions, tools, and router entry.
- `estimation` (old ID only) — the active agent uses ID `estimating` (Gauge). The old `estimation` string appears in type unions and some references.

**NOT touched:** `estimating` (Gauge), all other active agents, database tables (`estimation_projects`, `estimation_items`), the Estimation page/route, or any "estimation" text in natural-language prompts.

---

## Changes by File

### Frontend

| File | Change |
|------|--------|
| `src/lib/agent.ts` | Remove `"collections"`, `"estimation"`, `"commander"` from `AgentType` union |
| `src/components/chat/AgentSelector.tsx` | Remove `"collections"`, `"estimation"`, `"commander"` from type + `agents` array (Chase, Cal, Commander entries) |
| `src/hooks/useChatSessions.ts` | Remove `collections: "Chase"` and `estimation: "Cal"` from `agentTypeNameMap` |
| `src/lib/agentRouter.ts` | Remove `commander` route entry (lines 213-221). Keep "collection"/"collections" keywords under accounting. |
| `src/components/agent/agentSuggestionsData.ts` | Remove `commander` suggestions block (lines 101-105) |

### Backend (Edge Functions)

| File | Change |
|------|--------|
| `supabase/functions/_shared/agentTypes.ts` | Remove `"collections"`, `"estimation"`, `"commander"` from agent union type |
| `supabase/functions/_shared/agents/accounting.ts` | Remove `collections` prompt (lines 227-237) |
| `supabase/functions/_shared/agents/sales.ts` | Remove `commander` prompt (lines 295-362) |
| `supabase/functions/_shared/agentTools.ts` | Replace `agent === "collections"` with nothing (already covered by `agent === "accounting"`). Replace `agent === "commander"` → `agent === "sales"` where commander had same tools as sales. Remove standalone commander checks. Replace `agent === "estimation"` → `agent === "estimating"` |
| `supabase/functions/_shared/agentContext.ts` | Remove `agent === "commander"` context block (lines 67-86). Remove `agent === "collections"` from accounting condition (already has `agent === "accounting"`). Replace `agent === "estimation"` → `agent === "estimating"` |
| `supabase/functions/_shared/agentQA.ts` | Remove `"collections"`, `"estimation"`, `"commander"` from `HIGH_RISK_AGENTS`. Keep `"accounting"` and `"estimating"` |
| `supabase/functions/_shared/aiRouter.ts` | Remove `"commander"` from the complex-reasoning agent list (line 469). Replace `"estimation"` with `"estimating"` if present |
| `supabase/functions/agent-router/index.ts` | Remove `commander` from `AGENT_DESCRIPTIONS`. Rename `estimating` key stays as-is (already correct) |
| `supabase/functions/admin-chat/index.ts` | Remove `"collections"` and `"estimation"` from `agent_type` enum (line 777) |

### What is NOT changed
- `estimation_projects` / `estimation_items` DB tables — these are data tables, not agent IDs
- `src/pages/Estimation.tsx` — this is a feature page, not an agent
- `src/components/estimation/*` — estimation UI components stay
- Natural-language mentions of "collections" in Penny's prompt (e.g., "prioritize: collections → emails") — these are instructions, not agent references
- `agentConfigs.ts` — has no `collections` or `commander` entry (already clean). `estimating` key uses `agentType: "estimation"` which needs updating to match the cleaned type
- `src/components/agent/agentConfigs.ts` line 74: Change `agentType: "estimation"` → `agentType: "estimating"`

### Database
- No schema changes needed
- Existing chat sessions with `agent_type = 'collections'` or `'commander'` in the DB will display with fallback names (already handled by `getAgentName` returning the raw string)

---

## Validation Plan
1. Verify all TypeScript compiles with no errors after removing the types
2. Confirm no route references `/agent/commander` remain
3. Confirm `estimating` agent works end-to-end (Gauge)
4. Confirm Penny still handles collections-related queries via keyword routing

