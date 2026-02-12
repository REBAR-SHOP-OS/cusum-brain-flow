
# Phase 2: COMPLETED ✅

## What was done

### Part A: Phase T Stabilization ✅
- **A1**: Fixed `generate-suggestions` error handling — added `if (e instanceof Response) return e;`
- **A2**: Migrated all 6 remaining `.from("events")` references to `activity_events` with `source` and `dedupe_key`
  - `QueueToMachineDialog.tsx` → `activity_events` + `source: "system"` + `dedupe_key`
  - `manage-inventory/index.ts` (2 locations) → `activity_events` + `source: "system"`
  - `smart-dispatch/index.ts` → `activity_events` + `source: "system"`
  - `manage-machine/index.ts` (line 246) → `activity_events` + `source: "system"`
  - `daily-summary/index.ts` → SELECT from `activity_events`
  - `admin-chat/index.ts` → SELECT from `activity_events`
- **A3**: Dropped 4 duplicate RLS policies on `activity_events`

### Part B: Webhook Receivers ✅
- **B1**: Created `gmail-webhook` edge function — receives Google Pub/Sub push notifications, fetches new messages via `history.list`, upserts into `communications`, writes `activity_events` with `source: "gmail"` and deduplication
- **B2**: Created `ringcentral-webhook` edge function — handles RC validation handshake, processes call log and SMS events, upserts `communications`, writes `activity_events` with `source: "ringcentral"`
- **B3**: Updated `gmail-sync` to write `activity_events` after each successful communication upsert (`dedupe_key: "gmail:{messageId}"`)
- **B3**: Updated `ringcentral-sync` to write `activity_events` after each call/SMS upsert (`dedupe_key: "rc:{recordId}"`)

### Config Changes ✅
- Added `gmail-webhook` and `ringcentral-webhook` to `config.toml` with `verify_jwt = false`

### Edge Functions Deployed ✅
All 10 functions deployed: generate-suggestions, manage-inventory, smart-dispatch, manage-machine, daily-summary, admin-chat, gmail-sync, ringcentral-sync, gmail-webhook, ringcentral-webhook

## External Setup Required (by admin, outside Lovable)
- **Gmail**: Create a Google Cloud Pub/Sub topic + push subscription pointing to `https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/gmail-webhook`
- **RingCentral**: Register webhook subscription pointing to `https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/ringcentral-webhook`

---

# Phase 3: Next Steps (not started)
- Agent rule engine expansion (Relay agent processing activity_events → human_tasks)
- Dashboard for human_tasks management
- Webhook subscription management UI
