

## Per-Person Email Activity Report — Sent to Each Person's Email via ai@rebar.shop

### What This Does
Creates a new edge function `email-activity-report` that:
1. Reads today's emails from the `communications` table for each team member
2. Uses AI to extract key notes, action items, and summaries from each person's emails
3. Sends a personalized HTML report to each team member's email
4. Sends a master supervisory report to `ai@rebar.shop` with everyone's activity

### How It Works

```text
[communications table]
        |
        v
  Group emails by person
  (using TEAM_DIR mapping)
        |
        v
  AI summarizes each person's
  emails into notes + actions
        |
        +---> Send personal report to vicky@rebar.shop
        +---> Send personal report to saurabh@rebar.shop
        +---> Send personal report to ben@rebar.shop
        +---> ... (all team members with activity)
        |
        v
  Compile master report
  Send to ai@rebar.shop
```

### New Edge Function: `supabase/functions/email-activity-report/index.ts`

**Step 1 — Fetch today's communications**
- Query `communications` table for today (using `received_at`)
- Also fetch `chat_sessions`, `tasks`, `time_clock_entries` for full context
- All queries limited and date-filtered

**Step 2 — Group by team member**
- Use the hardcoded `TEAM_DIR` to match `from_address` and `to_address` to people
- For each person, collect: emails sent, emails received (with subjects and previews), tasks, agent sessions

**Step 3 — AI summarization (per person)**
- For each team member with activity, call Lovable AI (gemini-2.5-flash) with their data
- Prompt extracts: key notes, action items, follow-ups needed, flagged items
- Output is a short structured summary (not raw email dumps)

**Step 4 — Send personalized reports via Gmail**
- Use `ai@rebar.shop`'s Gmail token (from `user_gmail_tokens`) to send emails
- Each team member gets their own report with:
  - Their emails summary (sent/received with key notes)
  - Their tasks status
  - Their agent usage
  - Action items extracted from their communications
- Beautiful HTML email template (clean, mobile-friendly)

**Step 5 — Master supervisory report to ai@rebar.shop**
- Compile all per-person summaries into one master report
- Send to `ai@rebar.shop` as a supervisory overview
- Includes: who communicated with whom, total volumes, flagged items, action items across the team

### Role-Based Scoping (preserved)
- All team members get their **own** activity only
- The master report to `ai@rebar.shop` contains everything (admin-level)
- No financial data included in non-admin reports

### Safety Guards
- Rate limited: max 3 calls per hour via `check_rate_limit`
- Auth required: only admin roles can trigger the report
- All queries use `.limit(200)` and today-only date filters
- AI calls wrapped in try/catch -- failure produces a fallback text summary
- Gmail send failures are logged but don't crash the function
- Token decryption uses existing `_shared/tokenEncryption.ts`

### Report Email Format (HTML)

```text
Subject: Daily Activity Report — [Name] — [Date]

Hi [Name],

Here's your daily activity summary:

--- EMAILS ---
Sent: 5 | Received: 12
Key threads:
  - [Subject] from [Person] — [AI note/action]
  - [Subject] to [Person] — [AI note/action]

--- TASKS ---
3 open, 1 completed today

--- AI AGENT USAGE ---
2 sessions (Blitz, Penny)

--- ACTION ITEMS ---
1. Follow up with [person] about [topic]
2. Review [document] by EOD

— Rebar.shop AI Supervisor
```

### Files Created/Modified
- **New**: `supabase/functions/email-activity-report/index.ts` (~250 lines)
- **No changes** to existing files — this is a standalone function
- Uses existing `gmail-send` pattern for sending emails (token lookup + Gmail API)
- Uses existing `_shared/auth.ts` for authentication
- Uses existing `_shared/tokenEncryption.ts` for token decryption

### How to Trigger
- Can be called manually from the app (admin only)
- Can be scheduled via a cron job or called at end of day
- Endpoint: `POST /email-activity-report` with optional `{ "date": "YYYY-MM-DD" }`

