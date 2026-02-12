

# Agents v2: Vizzy + Penny + Forge -- Real Operational Agents with Voice

This plan turns the existing avatar-based chat agents into real operational agents backed by database tables, rule-based suggestion generation, and Vizzy voice chat in the user's preferred language.

---

## What Already Exists

- **Agent configs** in `agentConfigs.ts` with 17+ agents (we focus on Vizzy, Penny, Forge)
- **Hardcoded user-agent mapping** in `userAgentMap.ts` (email-based)
- **`suggestions` table** already exists with: id, company_id, suggestion_type, category, title, description, priority, context (JSONB), status, shown_to, shown_at, resolved_at
- **`profiles.preferred_language`** column already exists (default `'en'`)
- **ElevenLabs voice** already works for Vizzy via `VizzyPage.tsx` using `useConversation` hook + signed URLs
- **`useSpeechRecognition`** hook exists (browser-based STT)
- **`useCEODashboard`** already computes real exceptions, AR aging, at-risk jobs, capacity forecast
- **`useVizzyContext`** loads full business snapshot for Vizzy's AI brain
- **`elevenlabs-conversation-token`** edge function exists (locked to `sattar@rebar.shop`)

---

## Phase 1: Database Tables

### 1A. `agents` table (registry)
```
agents
  id          UUID PK
  code        TEXT UNIQUE (vizzy, penny, forge)
  name        TEXT
  default_role TEXT (ceo, accountant, shop_supervisor)
  enabled     BOOLEAN DEFAULT true
  created_at  TIMESTAMPTZ
```
Seed with 3 rows: Vizzy, Penny, Forge.

### 1B. `user_agents` table (1:1 assignment)
```
user_agents
  id          UUID PK
  user_id     UUID REFERENCES auth.users ON DELETE CASCADE
  agent_id    UUID REFERENCES agents
  mode        TEXT DEFAULT 'auto_by_role' (auto_by_role | manual)
  assigned_at TIMESTAMPTZ
  UNIQUE(user_id)
```

### 1C. Enhance existing `suggestions` table
Add columns to tie suggestions to agents and entities:
- `agent_id` UUID (nullable FK to agents)
- `entity_type` TEXT (invoice, machine, cut_plan, lead, etc.)
- `entity_id` TEXT (the specific record ID)
- `severity` TEXT DEFAULT 'info' (critical, warning, info)
- `reason` TEXT (why the AI is suggesting this)
- `impact` TEXT (money/time at risk)
- `actions` JSONB (array of action buttons)
- `snoozed_until` TIMESTAMPTZ

### 1D. `agent_action_log` table (audit trail)
```
agent_action_log
  id           UUID PK
  agent_id     UUID REFERENCES agents
  user_id      UUID REFERENCES auth.users
  company_id   UUID
  action_type  TEXT
  entity_type  TEXT
  entity_id    TEXT
  payload      JSONB
  result       JSONB
  created_at   TIMESTAMPTZ
```

### 1E. Add voice columns to `profiles`
- `preferred_voice_id` TEXT (ElevenLabs voice ID, nullable)
- `voice_enabled` BOOLEAN DEFAULT false

### RLS Policies
- All tables: company-scoped via `get_user_company_id(auth.uid())`
- `user_agents`: users can read their own; admins can read/write all
- `agent_action_log`: users can read own; admins can read all
- `agents`: read-only for authenticated users

---

## Phase 2: Auto-Assignment Logic

### Database trigger on `user_roles`
When a role is inserted/updated:
- `admin` role --> assign Vizzy
- `office` role (accountant context) --> assign Penny
- `shop` role --> assign Forge

### Edge function: `assign-agent`
Called by admin override or trigger. Ensures 1:1 mapping. Inserts/updates `user_agents`.

### Update `userAgentMap.ts`
Replace hardcoded email map with a database-driven hook `useUserAgent()` that:
1. Reads `user_agents` joined with `agents` for the current user
2. Falls back to the existing hardcoded map for backward compatibility
3. Returns the same `UserAgentMapping` shape

---

## Phase 3: Suggestion Generation Engine

### Edge function: `generate-suggestions`
A scheduled or on-demand function that:

**Vizzy (CEO) suggestions:**
- Queries `accounting_mirror` for overdue invoices > 30/60/90 days
- Queries `cut_plan_items` for at-risk jobs (low progress, approaching deadline)
- Queries `machines` for idle machines with queued backlog
- Queries `orders` with $0 total blocking invoicing

**Penny (Accounting) suggestions:**
- AR aging buckets from `accounting_mirror`
- Customers missing QuickBooks ID (blocks sync)
- Large balances overdue > threshold

**Forge (Shop Floor) suggestions:**
- Machine idle > threshold while `cut_plan_items` queued > 0
- Jobs due soon with < 50% completion
- Bender queue starving while cutter queue is high

Each suggestion is inserted into `suggestions` with:
- `agent_id` linking to the relevant agent
- `entity_type` + `entity_id` for deep linking
- `actions` JSONB with button configs (e.g., `[{label: "View Invoice", action: "navigate", path: "/orders/123"}]`)
- `severity` based on rule thresholds

### Deduplication
Before inserting, check if an open suggestion with the same `entity_type` + `entity_id` + `category` already exists. Skip if so.

---

## Phase 4: Suggestion Cards UI

### New component: `AgentSuggestionCard.tsx`
A consistent card displaying:
- Agent avatar + "AI suggests:" headline
- **Why:** 1-2 sentence reason
- **Impact:** dollar/time value (optional)
- Action buttons: **Act** / **Snooze** / **Dismiss**
- Act: navigates to entity or triggers action, logs to `agent_action_log`
- Snooze: sets `snoozed_until` to +24h
- Dismiss: sets status to `dismissed`

### New hook: `useAgentSuggestions(agentCode)`
Fetches suggestions filtered by agent and not snoozed/dismissed.

### Integration points:
- **CEO Dashboard** (`CEOPortal.tsx`): Show Vizzy cards in a dedicated section
- **Accounting pages** (AR, Orders): Show Penny cards
- **Shop Floor** (Station view, Foreman view): Show Forge cards

---

## Phase 5: Vizzy Voice Chat -- Multi-Language

### 5A. Unlock voice for all mapped users (not just CEO)
Update `elevenlabs-conversation-token/index.ts`:
- Remove `ALLOWED_EMAIL` restriction
- Check that the user has an assigned agent with `voice_enabled = true` in their profile
- OR check `has_role(userId, 'admin')`

Update `VizzyPage.tsx`:
- Remove `ALLOWED_EMAIL` check
- Load `preferred_language` and `preferred_voice_id` from profile
- Pass language preference to the ElevenLabs agent via `overrides` parameter or contextual update

### 5B. Language-aware voice pipeline
The current flow already works:
1. Browser captures audio --> ElevenLabs agent handles STT internally
2. Agent responds with text --> ElevenLabs TTS speaks it back

To add language support:
- The ElevenLabs Conversational AI agent already handles multilingual input/output (configured in the ElevenLabs dashboard)
- Inject `preferred_language` into the context update so the agent knows which language to default to
- Update `buildVizzyContext()` to include: `"CEO's preferred language: ${language}. Default to speaking in this language unless they switch."`

### 5C. Voice UI enhancements
- Add language badge (e.g., "FA", "EN") to the Vizzy voice page
- Show "Talk to Vizzy" button on CEO Dashboard (already exists as navigation to `/vizzy`)
- Add "Save summary as note" button at session end (save to `knowledge` table)
- Ensure transcript is always visible during the session

### 5D. Safety rules (already mostly implemented)
- Transcript always shown (already done)
- Voice sessions logged to `vizzy_interactions` + `chat_sessions` (already done)
- Quotation drafts require click approval (already done via `draft_quotation` client tool)
- Extend this pattern: all destructive actions require on-screen confirmation

---

## Phase 6: Email Integration (Agent = Human Email)

The existing `gmail-send` edge function already sends from the user's connected Gmail. No changes needed to the send pipeline.

### Add to agent actions:
- "Draft email" action in suggestion cards creates a draft in `draft-email` edge function
- Opens the email composer with pre-filled content
- "Send" requires explicit confirmation click
- Log to `agent_action_log` with recipients, subject, entity_id

---

## Technical Implementation Sequence

1. **Migration**: Create `agents`, `user_agents`, `agent_action_log` tables; alter `suggestions` with new columns; add `preferred_voice_id` and `voice_enabled` to `profiles`
2. **Seed data**: Insert Vizzy, Penny, Forge into `agents`; populate `user_agents` from existing `userAgentMap` emails
3. **Hook**: `useUserAgent()` -- replaces hardcoded map with DB query + fallback
4. **Edge function**: `generate-suggestions` -- rule engine for all 3 agents
5. **Components**: `AgentSuggestionCard.tsx` + `useAgentSuggestions()` hook
6. **Dashboard integration**: Wire cards into CEO Portal, Accounting pages, Shop Floor views
7. **Voice unlock**: Update token function + VizzyPage to support any voice-enabled user with language preference
8. **Action logging**: Wire Act/Snooze/Dismiss to `agent_action_log`

---

## Files to Create
- `src/hooks/useUserAgent.ts`
- `src/hooks/useAgentSuggestions.ts`
- `src/components/agent/AgentSuggestionCard.tsx`
- `supabase/functions/generate-suggestions/index.ts`

## Files to Modify
- `supabase/functions/elevenlabs-conversation-token/index.ts` (remove email lock, add role check)
- `src/pages/VizzyPage.tsx` (remove email lock, add language support)
- `src/lib/vizzyContext.ts` (inject language preference)
- `src/lib/userAgentMap.ts` (add DB-backed fallback)
- `src/pages/CEOPortal.tsx` or equivalent dashboard (add suggestion cards)
- `src/components/agent/agentConfigs.ts` (minor -- link agent codes)
- Database migration for new tables + column additions

