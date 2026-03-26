

# Auto-Post Email Replies to Sales Lead Timeline

## Problem
When an email is sent from the Sales Lead drawer via "Send Message", the sent email and any customer replies do not appear in the lead's timeline. The user wants a full email conversation thread visible inside the timeline.

## Solution — Two parts

### Part 1: Log outbound email to timeline on send

**`ComposeEmailDialog.tsx`** — Add an optional `onSent` callback prop that returns `{ to, subject, body, threadId, messageId }`.

**`SalesLeadDrawer.tsx`** — Pass `onSent` to `ComposeEmailDialog`. When fired:
- Insert a `sales_lead_activities` row with `activity_type: "email"`, subject, and body preview
- Store the Gmail `threadId` in a new `email_thread_id` column on `sales_leads` so we can match replies later

### Part 2: Match inbound emails to leads and auto-post to timeline

**`gmail-sync/index.ts`** — After upserting each message to `communications`, check if the email's `from_address` matches any `sales_leads.contact_email` OR the `thread_id` matches any `sales_leads.email_thread_id`. If matched, auto-insert a `sales_lead_activities` row with `activity_type: "email"`, direction `inbound`.

### Database changes
1. Add `email_thread_id text` column to `sales_leads` — stores the Gmail thread ID for reply matching
2. No other table changes needed; `sales_lead_activities` already supports `activity_type: "email"`

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `email_thread_id` to `sales_leads` |
| `src/components/inbox/ComposeEmailDialog.tsx` | Add optional `onSent` callback prop |
| `src/components/sales/SalesLeadDrawer.tsx` | Pass `onSent` → log email activity + save threadId to lead |
| `supabase/functions/gmail-sync/index.ts` | After upsert, match inbound emails to leads by contact_email or thread_id → auto-insert activity |

## Flow

```text
User sends email from Lead Drawer
  → ComposeEmailDialog calls gmail-send
  → onSent callback fires
  → SalesLeadDrawer inserts activity (type=email, outbound)
  → Saves threadId to sales_leads.email_thread_id

Customer replies via Gmail
  → gmail-sync cron picks up new message
  → Upserts to communications table
  → Checks: does from_address match any lead's contact_email?
     OR does thread_id match any lead's email_thread_id?
  → If yes: inserts sales_lead_activities (type=email, inbound)
  → Timeline auto-shows the reply
```

