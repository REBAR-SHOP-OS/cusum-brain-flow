

# Make SMS Fully Work: Send, Receive, and Auto-Reply

## Current State

| Feature | Status |
|---------|--------|
| **Send SMS** (admin-chat `rc_send_sms`) | Working — calls RC API directly |
| **Send SMS** (vizzy-erp-action) | Working — delegates to `ringcentral-action` |
| **Receive SMS** (cron sync) | Working — polls every 15 min, upserts to `communications` |
| **Receive SMS** (webhook) | Partially working — `ringcentral-webhook` handles `message-store` events, saves to DB |
| **Auto-reply to inbound SMS** | Missing — no AI response is generated or sent back |
| **SMS alert to CEO** | Working — `smsAlertHelper.ts` texts CEO on inbound SMS |

## The Gap

When someone texts the company number, the message is logged but nobody replies. The CEO wants Vizzy to auto-reply intelligently — like the call receptionist but via text.

## Plan

### 1. `supabase/functions/ringcentral-webhook/index.ts` — Add SMS Auto-Reply

In `handleMessageEvent()`, after upserting the inbound SMS to the database, add auto-reply logic:

- Only trigger for **inbound** SMS messages
- Skip if sender is the CEO's number (+14165870788) to avoid reply loops
- Skip if message is from a known no-reply/short-code number
- Call `vizzy-sms-reply` edge function (new) with the sender number, message text, and any matched contact info
- The reply is sent asynchronously — the webhook returns 200 immediately

~15 lines added.

### 2. `supabase/functions/vizzy-sms-reply/index.ts` — NEW: AI-Powered SMS Reply

New edge function that:

1. Receives: `{ from_number, message_text, contact_name, contact_id, company_id }`
2. Looks up contact context from DB (recent orders, open leads, past conversations)
3. Calls the AI (Gemini 2.5 Flash) with a sales-agent prompt similar to the call receptionist:
   - Product catalog knowledge (10M-35M rebar, bending, pricing)
   - Business hours awareness
   - Team directory for escalation
   - Keep replies short (SMS-appropriate, under 160 chars when possible)
4. Sends the reply via RC SMS API (using `smsAlertHelper` pattern for token management)
5. Logs the outbound reply to `communications` table
6. If the message looks like an RFQ or urgent request, also creates a notification for CEO approval

Prompt guidelines:
- Friendly, professional, concise (SMS style)
- Can answer: product questions, pricing ballparks, business hours, location
- Cannot answer: specific order statuses, exact invoices
- If complex: "I'll have our team follow up with you shortly!"
- Always identifies as "Vizzy from Rebar Shop"

~120 lines.

### 3. `supabase/functions/_shared/vizzyIdentity.ts` — Update CAN DO List

Add: "Auto-reply to inbound SMS messages as a knowledgeable sales agent — answer product questions, provide pricing, and flag RFQs for CEO approval."

~2 lines.

### 4. Loop Prevention

Critical safety measures in the auto-reply logic:
- **Skip CEO's number** (+14165870788) — never auto-reply to the boss
- **Skip own numbers** — never reply to messages sent from company numbers
- **Dedupe by conversation** — don't reply to the same thread more than once per 2 minutes
- **Max replies per number** — cap at 5 auto-replies per unique number per day to prevent spam loops

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/vizzy-sms-reply/index.ts` | NEW — AI-powered SMS auto-reply (~120 lines) |
| `supabase/functions/ringcentral-webhook/index.ts` | Trigger auto-reply on inbound SMS (~15 lines) |
| `supabase/functions/_shared/vizzyIdentity.ts` | Update CAN DO list (~2 lines) |

## SMS Flow After Changes

```text
Inbound SMS arrives
  │
  ├── Webhook fires (or cron syncs)
  │   ├── Save to communications table
  │   ├── SMS alert to CEO (+14165870788)
  │   └── Trigger vizzy-sms-reply
  │
  └── vizzy-sms-reply:
      ├── Skip if from CEO or own number
      ├── Check rate limits (5/day per number)
      ├── Fetch contact context from DB
      ├── AI generates short, helpful reply
      ├── Send reply via RC SMS API
      ├── Log outbound reply to communications
      └── If RFQ detected → notification for CEO
```

## Impact
- 3 files (1 new, 2 updated)
- Inbound SMS gets an immediate AI-powered reply
- Loop prevention ensures no spam or self-replies
- CEO still gets SMS alerts for every inbound message
- RFQs captured via text are flagged for approval
- No database or auth changes

