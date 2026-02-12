

# Phase 2: Webhook Receivers + Phase T Stabilization

## Part A: Stabilize Phase 1 (Phase T Fixes)

Before adding new capabilities, we need to fix the remaining issues from Phase 1.

### A1. Fix generate-suggestions error handling
The catch block wraps thrown `Response` objects with `String()`, producing `"[object Response]"` 500 errors. Add `if (e instanceof Response) return e;` before the generic catch.

### A2. Migrate remaining `.from("events")` references (6 locations)
These still use the old table name (working via the backward-compat view, but INSERTs should go directly to `activity_events` with `source` and `dedupe_key`):

| File | Action |
|---|---|
| `src/components/cutter/QueueToMachineDialog.tsx` (line 58) | Change to `activity_events`, add `source: "system"`, `dedupe_key: "cut_plan_queued:{plan.id}"` |
| `supabase/functions/manage-inventory/index.ts` (lines 178, 536) | Change to `activity_events`, add `source: "system"` |
| `supabase/functions/smart-dispatch/index.ts` (line 395) | Change to `activity_events`, add `source: "system"` |
| `supabase/functions/manage-machine/index.ts` (line 246) | Change to `activity_events`, add `source: "system"` |
| `supabase/functions/daily-summary/index.ts` (line 657) | Change SELECT to `activity_events` |
| `supabase/functions/admin-chat/index.ts` (line 66) | Change SELECT to `activity_events` |

### A3. Drop duplicate RLS policies (database migration)
Remove the 4 old renamed policies on `activity_events` (`Staff read events in company`, etc.) — the new `activity_events_select/insert/update/delete` policies handle everything.

---

## Part B: Webhook Receivers (Phase 2)

### B1. Gmail Push Notifications via Pub/Sub

Create a new edge function `gmail-webhook` that receives Gmail push notifications:

1. **Setup flow**: A new action `"watch"` in the existing `gmail-sync` function calls `POST /gmail/v1/users/me/watch` with a Cloud Pub/Sub topic to subscribe to mailbox changes
2. **Receiver**: New `gmail-webhook/index.ts` edge function (public endpoint, no JWT) that:
   - Receives Pub/Sub push messages (POST with base64-encoded data containing `emailAddress` and `historyId`)
   - Validates the request (checks expected fields)
   - Looks up the user by Gmail email in `user_gmail_tokens`
   - Fetches new messages since last known `historyId` via `history.list` API
   - Upserts into `communications` table (same as current gmail-sync)
   - Writes an `activity_events` entry with `source: "gmail"`, `dedupe_key: "gmail:{messageId}"`
   - Rate-limits to prevent Pub/Sub replay storms

**Note**: Gmail Pub/Sub requires a Google Cloud project with Pub/Sub enabled and a push subscription pointing to our edge function URL. This is configured outside Lovable (in Google Cloud Console). The edge function just receives the pushes.

### B2. RingCentral Webhook Receiver

Create a new edge function `ringcentral-webhook` that receives RC webhook events:

1. **Subscription setup**: New action `"subscribe"` in `ringcentral-sync` that calls RC's subscription API to register a webhook URL pointing to our edge function
2. **Receiver**: New `ringcentral-webhook/index.ts` edge function (public endpoint) that:
   - Handles RC's `validation-token` handshake (returns the token in `Validation-Token` header)
   - Receives call log and message events
   - Upserts into `communications` table
   - Writes `activity_events` with `source: "ringcentral"`, `dedupe_key: "rc:{event.id}"`
   - Handles RC 429 `Retry-After` trap (respects the header, logs warning)

### B3. Feed activity_events from gmail-sync and ringcentral-sync

Even before webhooks are fully operational, update the existing polling sync functions to write `activity_events` entries when they upsert communications:

- **gmail-sync**: After each successful communication upsert, insert `activity_events` with `source: "gmail"`, `event_type: "email_received"`, `dedupe_key: "gmail:{messageId}"`
- **ringcentral-sync**: After each call/SMS upsert, insert `activity_events` with `source: "ringcentral"`, `event_type: "call_logged" | "sms_received"`, `dedupe_key: "rc:{recordId}"`

This ensures the rule engine in `generate-suggestions` can see external communication events regardless of whether push or poll delivers them.

---

## Files to Create
- `supabase/functions/gmail-webhook/index.ts` -- Pub/Sub push receiver
- `supabase/functions/ringcentral-webhook/index.ts` -- RC webhook receiver

## Files to Modify
- `supabase/functions/generate-suggestions/index.ts` -- fix error handling (Part A)
- `src/components/cutter/QueueToMachineDialog.tsx` -- migrate to activity_events
- `supabase/functions/manage-inventory/index.ts` -- migrate 2 references
- `supabase/functions/smart-dispatch/index.ts` -- migrate 1 reference
- `supabase/functions/manage-machine/index.ts` -- migrate 1 reference
- `supabase/functions/daily-summary/index.ts` -- migrate SELECT
- `supabase/functions/admin-chat/index.ts` -- migrate SELECT
- `supabase/functions/gmail-sync/index.ts` -- add activity_events writes after upserts
- `supabase/functions/ringcentral-sync/index.ts` -- add activity_events writes after upserts
- 1 database migration (drop duplicate RLS policies)

## Edge Functions to Deploy
- gmail-webhook (new), ringcentral-webhook (new)
- generate-suggestions, manage-inventory, smart-dispatch, manage-machine, daily-summary, admin-chat, gmail-sync, ringcentral-sync (updated)

## Config Changes
- Add `gmail-webhook` and `ringcentral-webhook` to `config.toml` with `verify_jwt = false` (public webhook endpoints)

## External Setup Required (by admin, outside Lovable)
- **Gmail**: Create a Google Cloud Pub/Sub topic + push subscription pointing to the `gmail-webhook` edge function URL
- **RingCentral**: Call the `subscribe` action to register the webhook URL with RingCentral's subscription API

