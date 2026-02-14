

# Upgrade Vizzy to JARVIS-Level AI Assistant

## Vision
Transform Vizzy from a super-admin-only voice assistant into a full JARVIS-like experience: always available, deeply contextual, with access to ALL business and personal data, proactive intelligence, and seamless voice/text switching.

---

## Current State
- **Voice Vizzy** (`/vizzy`): ElevenLabs-powered voice agent, locked to `sattar@rebar.shop` only. Loads full business snapshot (financials, production, CRM, emails, team presence, knowledge base). Can make calls, send SMS, draft quotations.
- **Text Chat** (`/chat`): Uses `admin-chat` edge function, also locked to super admin. Loads limited context (work orders, machines, events, stock) -- much less than voice Vizzy.
- **Floating Button**: Navigates to `/chat` (text) or `/vizzy` (voice). Only visible to mapped users.

## Key Gaps
1. **Text chat has far less context than voice Vizzy** -- no financials, no emails, no team presence, no knowledge base
2. **No personal assistant capabilities** -- no calendar awareness, reminders, personal notes
3. **No proactive intelligence** -- Vizzy waits to be asked, never surfaces insights on its own
4. **No persistent memory** -- each session starts fresh with no recall of past conversations

---

## Implementation Plan

### 1. Supercharge the Text Chat Backend (`admin-chat` edge function)

Give the text-based Vizzy the same full business context that voice Vizzy gets.

**Changes to `supabase/functions/admin-chat/index.ts`:**
- Add queries for: financials (accounting_mirror), leads/pipeline, deliveries, team presence (time_clock_entries), inbound emails (communications), knowledge base entries, agent activity (chat_sessions), cut plans, and customer data
- Build a comprehensive system prompt matching `vizzyContext.ts` format -- financials, production, CRM, team directory, emails, brain knowledge
- Add personal assistant instructions: "You are JARVIS to your CEO. Handle personal requests (reminders, scheduling ideas, brainstorming) alongside business tasks."
- Upgrade model from `google/gemini-3-flash-preview` to `google/gemini-3-pro-preview` for deeper reasoning

### 2. Add Personal Notes and Memory System

**Database migration:**
- Create `vizzy_memory` table: `id`, `user_id`, `category` (enum: business, personal, reminder, insight), `content` (text), `metadata` (jsonb), `created_at`, `expires_at` (nullable), `company_id`
- RLS: user can only read/write their own entries
- Enable realtime

**Edge function changes (`admin-chat`):**
- Query `vizzy_memory` for the current user and inject into context as "PERSISTENT MEMORY"
- Add tool-calling support: when Vizzy says "I'll remember that" or user says "remember this", the edge function saves to `vizzy_memory`
- Add structured output via tool calling for memory operations: `save_memory(category, content, expires_at?)`, `list_memories()`, `delete_memory(id)`

### 3. Proactive Daily Briefing

**New component: `src/components/vizzy/VizzyDailyBriefing.tsx`**
- On Home page load (for mapped users), auto-fetch a condensed briefing
- Call a new edge function `vizzy-daily-brief` that:
  - Loads the full business snapshot (reuse same queries)
  - Asks Gemini 3 Pro to generate a 5-bullet "Good morning" briefing highlighting: urgent items, overdue invoices, hot leads, team absences, production blockers
- Display as a dismissible card at the top of the Home page with the agent avatar
- Store dismissal in localStorage so it only shows once per day

### 4. Unified Context Builder (Shared Module)

**New file: `supabase/functions/_shared/vizzyFullContext.ts`**
- Extract the context-building logic from `admin-chat` into a shared module
- Both `admin-chat` and `vizzy-daily-brief` import from here
- Matches the same data as `useVizzyContext.ts` + `vizzyContext.ts` on the client side, but runs server-side for edge functions

### 5. Enhanced System Prompt (JARVIS Personality)

Update the system prompt to include:
- "You are JARVIS -- the CEO's personal and business AI. You handle EVERYTHING."
- Personal capabilities: brainstorming, writing emails/messages, personal reminders, tracking habits, journaling thoughts
- Proactive behavior: "If you notice anomalies in the data, mention them even if not asked"
- Memory awareness: "You have persistent memory. Reference past conversations when relevant."
- Cross-domain intelligence: "Connect dots -- if a customer emailed about delays AND production is behind, flag the connection"

### 6. Quick Access Improvements

**Update `src/components/vizzy/FloatingVizzyButton.tsx`:**
- Add a long-press gesture (500ms hold) to open voice Vizzy directly (`/vizzy`) vs. single tap for text chat (`/chat`)
- Add a subtle tooltip on first use: "Tap for text, hold for voice"

**Update `src/pages/LiveChat.tsx`:**
- Add a greeting that shows the daily briefing summary inline as the first message (auto-generated on page load)
- Show "Vizzy remembers X items from past sessions" indicator in header

---

## Technical Details

### File: `supabase/functions/_shared/vizzyFullContext.ts` (New)
- Export `async function buildFullVizzyContext(supabase, userId)` 
- Runs all parallel queries: accounting_mirror, cut_plans, cut_plan_items, machines, leads, customers, deliveries, profiles, activity_events, knowledge, chat_sessions, time_clock_entries, communications, vizzy_memory
- Returns formatted context string matching `vizzyContext.ts` format
- Includes personal memory section

### File: `supabase/functions/admin-chat/index.ts` (Major update)
- Import and use `buildFullVizzyContext` for system prompt
- Upgrade model to `google/gemini-3-pro-preview`
- Add tool definitions for memory operations: `save_memory`, `list_memories`
- Process tool calls in response: if AI calls `save_memory`, insert into `vizzy_memory` table, then continue conversation
- Keep rate limiting and auth checks

### File: `supabase/functions/vizzy-daily-brief/index.ts` (New)
- Auth required, rate limited (1 per 30 minutes)
- Uses `buildFullVizzyContext` to get snapshot
- Asks Gemini 3 Pro for a 5-bullet briefing
- Returns `{ briefing: string, generated_at: string }`

### Database Migration
```text
CREATE TABLE public.vizzy_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  company_id UUID NOT NULL REFERENCES public.companies(id)
);

ALTER TABLE public.vizzy_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memories"
  ON public.vizzy_memory FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### File: `src/components/vizzy/VizzyDailyBriefing.tsx` (New)
- Calls `supabase.functions.invoke("vizzy-daily-brief")`
- Renders dismissible card with framer-motion animation
- Shows agent avatar, briefing bullets, timestamp
- "Ask Vizzy more" button navigates to `/chat`

### File: `src/pages/Home.tsx` (Minor update)
- Import and render `VizzyDailyBriefing` above the agent cards for mapped users

### File: `src/components/vizzy/FloatingVizzyButton.tsx` (Minor update)
- Add long-press detection (500ms timer on pointerDown, clear on pointerUp if < 500ms)
- Long press navigates to `/vizzy`, short tap to `/chat`

### File: `src/pages/LiveChat.tsx` (Minor update)
- On mount, fetch memory count from `vizzy_memory` table
- Show "Vizzy has X memories from past sessions" in header subtitle
- Auto-send a greeting request on first load to get contextual "Good morning" response

### Files Unchanged
- `src/hooks/useVizzyContext.ts` -- client-side voice context loader stays the same
- `src/lib/vizzyContext.ts` -- voice context builder stays the same
- `supabase/functions/vizzy-briefing/index.ts` -- voice briefing compressor stays the same
- `supabase/functions/elevenlabs-conversation-token/index.ts` -- no changes
