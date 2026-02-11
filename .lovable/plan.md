

## Brain AI Genius Mode — Communication Intelligence + Employee Coaching

### What This Does
Transforms the existing Brain AI from a static knowledge storage into an **active intelligence layer** that:
1. Automatically ingests and analyzes ALL team communications (emails, agent chats, tasks)
2. Learns each person's communication patterns, strengths, and gaps
3. Generates real-time coaching insights accessible to every AI agent
4. Proactively creates "Brain Observations" — stored as knowledge items — so the AI remembers patterns across days

### How It Works

```text
[communications]  [chat_sessions]  [tasks]  [time_clock]
       |                |             |           |
       v                v             v           v
   ┌──────────────────────────────────────────────┐
   │     BRAIN INTELLIGENCE LAYER                 │
   │  (runs inside ai-agent fetchContext)         │
   │                                              │
   │  1. Read today's raw data per person          │
   │  2. Analyze communication quality             │
   │  3. Detect collaboration patterns             │
   │  4. Score responsiveness & follow-through     │
   │  5. Generate coaching tips                    │
   │  6. Save observations to knowledge table      │
   │  7. Inject intelligence into ALL agents       │
   └──────────────────────────────────────────────┘
           |                          |
           v                          v
   [Every agent gets              [knowledge table
    team intelligence              stores patterns
    in their context]              across days]
```

### Changes Overview

**File 1: `supabase/functions/ai-agent/index.ts`** (~80 lines added to fetchContext)

Upgrade the existing Team Activity Report block (lines 2066-2193) to become a full **Brain Intelligence Engine**:

**Step 1 — Deeper data collection** (expand existing parallel queries)
- Add `chat_messages` query: fetch today's user messages (role="user") from `chat_sessions`, truncated to 150 chars each, limit 300
- Add `communications` body_preview + subject (already fetched but only counting — now extract actual content)
- Keep existing clock, sessions, tasks queries

**Step 2 — Per-person communication analysis** (new logic block)
For each team member, compute:
- **Response score**: ratio of emails received vs sent (are they responsive?)
- **Collaboration map**: who they emailed most today (shows team interaction patterns)
- **AI engagement**: what topics they asked agents about (shows what they're working on)
- **Task velocity**: created vs completed ratio
- **Communication quality flags**: unanswered emails (received but no reply), overdue tasks

**Step 3 — Cross-team intelligence** (new logic block)
- **Communication gaps**: detect pairs who should be talking but aren't (e.g., Sales got a new lead but hasn't looped in Estimating)
- **Bottleneck detection**: if one person has many unanswered emails, flag as potential bottleneck
- **Collaboration score**: overall team interaction density

**Step 4 — Build brain intelligence report** (replaces current simple text report)
Format as structured text injected into context:
```
BRAIN INTELLIGENCE REPORT (Today)

TEAM PULSE: 78/100
- Communication Health: Active (23 internal emails, 4 cross-dept threads)
- Bottleneck: Vicky has 6 unanswered emails
- Gap: Saurabh (Sales) hasn't looped Ben (Estimating) on 2 new leads

PER-PERSON INTELLIGENCE:

Sattar Esmaeili (CEO)
  Response: 4/5 emails answered | Collaboration: vicky(3), saurabh(2), external(5)
  AI Topics: "pipeline review", "overdue invoices"
  Coaching: Strong follow-through today. Consider delegating external email replies.

Vicky Anderson (Accountant)
  Response: 2/8 emails answered | Collaboration: sattar(3), external(5)
  AI Topics: "AR aging", "invoice status"
  Coaching: 6 unanswered emails — prioritize customer replies before EOD.

Saurabh Seghal (Sales)
  Response: 7/7 answered | Collaboration: external(6), neel(1)
  AI Topics: "lead scoring", "quote follow-up"
  Coaching: Excellent responsiveness. Loop Ben in on new project leads.
```

**Step 5 — Save brain observations to knowledge table** (new async block)
After building the intelligence report, save a daily summary as a `knowledge` item:
- Category: "memory"
- Title: "Brain Observation — {date}"
- Content: condensed per-person patterns + team health
- This means the AI remembers patterns across days and can say "Vicky has been slow on email replies for 3 days"

**Step 6 — Update prompt injection** (modify SHARED_TOOL_INSTRUCTIONS)
Add instruction block telling all agents:
```
## Brain Intelligence (Today)
{brainIntelligenceReport}

USE THIS DATA TO:
- Proactively coach the user based on their patterns
- Suggest collaboration improvements
- Flag bottlenecks and communication gaps
- Reference historical patterns from knowledge table
- Help team members improve their work habits

COACHING STYLE: Be a supportive, data-driven mentor. Highlight good behaviors
first, then gently point out improvements. Never be judgmental.
```

**File 2: `supabase/functions/email-activity-report/index.ts`** (~40 lines changed)

Upgrade the AI summarization prompt to include coaching analysis:
- Change the prompt from simple "extract notes and action items" to:
  - Analyze communication patterns (response time, follow-through)
  - Identify strengths (fast replies, proactive outreach)
  - Identify improvements (unanswered emails, missed follow-ups)
  - Score performance (0-100)
  - Generate 2-3 specific coaching tips
- Upgrade HTML templates to include coaching sections with color coding

### What Every Agent Can Now Do
After this change, ANY agent (Blitz, Penny, Forge, etc.) can answer:
- "How is the team doing today?" — shows team pulse score + per-person summary
- "Who needs help?" — highlights bottlenecks and unanswered communications
- "How am I doing?" — shows the user's own responsiveness and coaching tips
- "Is Saurabh following up on leads?" — checks his email patterns and AI usage
- "Who talked to whom today?" — shows the collaboration map
- "What has Vicky been working on?" — shows her agent topics and email subjects

### Role-Based Scoping (preserved)
- Admin/Office/Sales/Accounting: See full intelligence for all team members
- Workshop/Field: See only their own coaching data + team clock status
- Knowledge observations saved with company_id for multi-tenant isolation

### Safety Guards
- All queries use `.limit()` and today-only date filters
- Chat messages truncated to 150 chars (no full conversations leaked)
- Email previews truncated to 100 chars
- Knowledge observations are max 2000 chars (condensed summary)
- Only saves 1 observation per day (checks for existing before inserting)
- Total added token budget to agent context: ~500-800 tokens
- All wrapped in try/catch — failure returns existing simple report as fallback
- No schema changes, no new tables, no UI changes

### Files Modified
- `supabase/functions/ai-agent/index.ts` — upgrade Team Activity block + update SHARED_TOOL_INSTRUCTIONS
- `supabase/functions/email-activity-report/index.ts` — upgrade AI prompt + HTML template for coaching

