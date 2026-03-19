

# Vizzy Morning Executive Partner — Full Upgrade

## What We're Building

Transform Vizzy from a reactive Q&A voice assistant into a **proactive morning executive partner** that:
1. Opens with a warm, personalized good morning + motivational message
2. Automatically analyzes ALL databases and prioritizes findings
3. Reads through emails and presents them for review/reply
4. Creates tasks for employees directly from voice commands
5. Supervises all calls and communications proactively
6. Proposes a daily schedule based on priorities

## Changes

### 1. Update Voice Instructions (`src/hooks/useVizzyVoiceEngine.ts`)

Add new instruction sections:

**Morning Greeting Protocol**: When session starts, Vizzy immediately delivers a warm, personalized good morning with something motivational (quote, observation, or encouragement), then seamlessly transitions into the briefing without waiting for a prompt.

**Proactive Briefing Flow** (no waiting for "what's up?"):
1. Greeting → motivational opener
2. Critical alerts (red flags ranked by severity)
3. Email review: "You got X emails — here are the ones that need attention..."
4. Call/communication supervision summary
5. Proposed daily priorities: "Here's what I think your day should look like..."
6. Wait for CEO's go/no-go on each item

**Task Creation via Voice**: New `[VIZZY-ACTION]` type:
```
[VIZZY-ACTION]{"type":"create_task","title":"...","description":"...","assigned_to_name":"Neel","priority":"high"}[/VIZZY-ACTION]
```

**Email Reply via Voice**: New `[VIZZY-ACTION]` type:
```
[VIZZY-ACTION]{"type":"send_email","to":"email","subject":"Re: ...","body":"...","threadId":"..."}[/VIZZY-ACTION]
```

**Daily Schedule Proposal**: Vizzy builds a proposed schedule from:
- Overdue invoices needing follow-up
- Hot leads needing action
- Deliveries to track
- Production issues to address
- Emails requiring replies

### 2. Add `create_task` and `send_email` to ERP Action Function (`supabase/functions/vizzy-erp-action/index.ts`)

**`create_task`**: Resolves employee name → profile ID → assigns `human_tasks` row with company_id, title, description, priority, assigned_to.

**`send_email`**: Calls `gmail-send` internally using the CEO's auth context. Accepts to, subject, body, threadId for replies.

### 3. Expand Email Context (`supabase/functions/_shared/vizzyFullContext.ts`)

- Increase `body_preview` from 50 chars to 500 chars for inbox emails
- Include `id` and `thread_id` fields so Vizzy can reference specific emails for replies
- Add `to_address` to email display

### 4. Wire Up New Actions in UI (`src/pages/AgentWorkspace.tsx` + `src/components/vizzy/VizzyVoiceChat.tsx`)

**AgentWorkspace.tsx**: Extend `[VIZZY-ACTION]` parser to handle `create_task` and `send_email` types, calling `vizzy-erp-action` with approval flow.

**VizzyVoiceChat.tsx**: Add transcript-level `[VIZZY-ACTION]` parsing for voice sessions (currently only text chat handles actions). When Vizzy speaks an action tag, show an approval button overlay before executing.

### 5. Update Pre-Digest for Morning Mode (`supabase/functions/vizzy-pre-digest/index.ts`)

Add to the AI prompt:
- Generate a "Morning Schedule Proposal" section with time-blocked priorities
- Include email triage summary (urgent/needs-reply/FYI)
- Include motivational opener suggestion based on business performance

## Technical Details

**Files to modify:**
- `src/hooks/useVizzyVoiceEngine.ts` — morning protocol, new action types, email/task instructions
- `supabase/functions/vizzy-erp-action/index.ts` — add `create_task` and `send_email` cases
- `supabase/functions/_shared/vizzyFullContext.ts` — expand email context fields
- `src/components/vizzy/VizzyVoiceChat.tsx` — add voice-level action parsing + approval UI
- `src/pages/AgentWorkspace.tsx` — extend action handler for new types
- `supabase/functions/vizzy-pre-digest/index.ts` — morning schedule + email triage in digest

**Employee name → profile resolution** for task assignment will use a lookup query: `profiles.full_name ILIKE '%name%'` to resolve the `assigned_to` UUID from a spoken name.

**Email reply flow**: Vizzy reads the email aloud → proposes reply → CEO says "send it" → `[VIZZY-ACTION]` emitted → approval shown → `vizzy-erp-action` calls `gmail-send`.

