

## Relay Workflow Engine -- 5-Layer Email Automation

### Overview

Replace the current keyword-based `categorizeCommunication()` function with a real AI pipeline that runs server-side on every Gmail sync. Every inbound email gets classified, prioritized, and (for non-spam) auto-drafted -- all before the user opens their inbox.

**Strategy: Option A** -- auto-draft for ALL non-spam emails. Drafts are never auto-sent; they appear as suggestions for one-click approval.

---

### How It Works

```text
Gmail Sync (existing) completes
         |
         v
relay-pipeline edge function (NEW)
         |
    1. CLASSIFY  --> ai_category, ai_urgency, ai_action_required
         |
    if spam/marketing --> tag + STOP
         |
    2. PRIORITIZE --> ai_priority_data (action, deadline, risk, opportunity)
         |
    3. DRAFT     --> ai_draft (reuses draft-email prompt logic)
         |
    4. ALERT     --> only for: RFQ-high, payment-overdue, delivery-issue, missed-reply >4h
         |
    5. CLOSE LOOP (triggered separately when thread resolved)
```

---

### Database Changes

**Add 9 columns to the existing `communications` table:**

| Column | Type | Purpose |
|--------|------|---------|
| `ai_category` | `text` | RFQ, Active Customer, Payment, Vendor, Internal, Marketing, Spam |
| `ai_urgency` | `text` | high, medium, low |
| `ai_action_required` | `boolean` | Whether a reply is needed |
| `ai_action_summary` | `text` | One-line description of what needs to happen |
| `ai_draft` | `text` | Suggested reply draft |
| `ai_processed_at` | `timestamptz` | When the pipeline last ran on this row |
| `ai_priority_data` | `jsonb` | Structured: deadline, risk_level, opportunity_value, next_step |
| `resolved_at` | `timestamptz` | When the thread was closed |
| `resolved_summary` | `text` | AI-generated summary on close |

No new tables required.

---

### New Edge Function: `relay-pipeline`

Single function with 3 actions dispatched via `body.action`:

**`action: "process"`** -- Runs layers 1-4 on unprocessed inbound emails (batch of up to 10 at a time)

- Queries `communications` where `ai_processed_at IS NULL` and `direction = 'inbound'`
- For each email:
  - **Classify** using `google/gemini-2.5-flash-lite` with tool-calling to get structured category/urgency/action_required
  - If Marketing or Spam: tag and skip to next
  - **Prioritize** using `google/gemini-2.5-flash` with tool-calling to extract action, deadline, risk, opportunity
  - **Draft** using `google/gemini-2.5-flash` with the same system prompt style from the existing `draft-email` function
  - **Alert check**: if RFQ + high urgency, or payment overdue, or delivery issue -- insert into `comms_alerts` and send via `ai@rebar.shop` (reuses existing `comms-alerts` email-sending logic)
- Updates each row with all AI columns + sets `ai_processed_at = now()`

**`action: "close-thread"`** -- Runs layer 5 on a specific communication

- Takes `communicationId` in request body
- Generates a 2-sentence thread summary via AI
- Sets `resolved_at` and `resolved_summary`
- Logs an event to the `events` table

**`action: "relay-brief"`** -- Generates daily summary

- Queries last 24h of classified communications
- Produces a structured brief: total inbound, RFQs, opportunities, complaints, missed replies, revenue risk, top 3 actions
- Returns the brief text (can be sent via email or displayed in UI)

Auth-guarded via `requireAuth`. Rate-limited at 10 requests/minute. Uses `LOVABLE_API_KEY` (already configured).

---

### Frontend Changes

**`src/hooks/useCommunications.ts`**
- Add the new AI columns to the Communication interface: `aiCategory`, `aiUrgency`, `aiActionRequired`, `aiDraft`, `aiPriorityData`, `resolvedAt`
- Map them from the DB response

**`src/components/inbox/InboxView.tsx`**
- Replace the keyword-based `categorizeCommunication()` function: if `ai_category` exists on the row, use it directly; otherwise fall back to existing keyword logic for backwards compatibility
- Map AI categories to the existing label/color system (RFQ -> "Urgent" red, Payment -> "FYI" amber, Marketing -> "Marketing" pink, Spam -> "Spam" gray, etc.)
- Add a "Run Relay" button to the AI toolbar that calls `relay-pipeline` with `action: "process"` then refreshes
- Show unprocessed email count badge on the Run Relay button

**`src/components/inbox/InboxAIToolbar.tsx`**
- Add "Run Relay" as a new action type with a Zap icon
- Wire it to invoke the `relay-pipeline` edge function

**`src/components/inbox/InboxEmailViewer.tsx`**
- When `ai_draft` is populated, show a collapsible "Suggested Reply" panel above the action bar
- One-click button to load the draft into the reply composer
- Show a compact "AI Summary" bar below the subject: category badge, urgency level, action summary, deadline/risk from `ai_priority_data`
- Add a "Resolve Thread" button in the footer that calls `relay-pipeline` with `action: "close-thread"`

**`src/components/inbox/InboxSummaryPanel.tsx`**
- Update to optionally display the Relay Brief content (from `relay-brief` action) instead of the current basic stat counts

---

### Config Changes

**`supabase/config.toml`**
- Add `[functions.relay-pipeline]` with `verify_jwt = false`

---

### Files Summary

| File | Change |
|------|--------|
| Migration SQL | Add 9 columns to `communications` |
| `supabase/functions/relay-pipeline/index.ts` | NEW -- 5-layer pipeline engine |
| `supabase/config.toml` | Add relay-pipeline entry |
| `src/hooks/useCommunications.ts` | Add AI fields to interface + mapping |
| `src/components/inbox/InboxView.tsx` | Use AI labels when available; replace keyword categorizer |
| `src/components/inbox/InboxAIToolbar.tsx` | Add "Run Relay" button |
| `src/components/inbox/InboxEmailViewer.tsx` | Show AI draft suggestion + priority bar + resolve button |

### What Does NOT Change
- Existing `draft-email` edge function (stays for on-demand single-email drafts)
- Existing `comms-alerts` edge function (stays for scheduled alert checks)
- Existing `gmail-sync` and `ringcentral-sync` (pipeline runs after sync, not during)

