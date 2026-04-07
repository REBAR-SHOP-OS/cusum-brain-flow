

# Make RingCentral Live: Register Webhook Subscription + Fix Dead Extension

## Current State

- **Webhook handler exists** (`ringcentral-webhook/index.ts`) — fully functional, handles calls, SMS, voicemails
- **No webhook subscription registered** with RingCentral — the handler never receives events
- **System relies on 15-min cron poll** — not "live"
- **Extension 340479042** causes errors every sync cycle (404 "Resource not found") — likely deleted/disabled in RC

## What Changes

### 1. NEW: `supabase/functions/ringcentral-register-webhook/index.ts`

A new edge function that registers a RingCentral webhook subscription via the RC API:

- Calls `POST /restapi/v1.0/subscription` with event filters:
  - `/restapi/v1.0/account/~/extension/~/telephony/sessions` (live calls)
  - `/restapi/v1.0/account/~/extension/~/message-store` (SMS, voicemail, fax — per-extension)
- Sets delivery mode to `WebHook` pointing at `{SUPABASE_URL}/functions/v1/ringcentral-webhook?token={RINGCENTRAL_WEBHOOK_SECRET}`
- Uses the admin RC token from `user_ringcentral_tokens` (same pattern as cron sync)
- Returns subscription ID and expiration
- Can be called manually or scheduled to renew before expiry (RC subscriptions expire in ~15 min unless renewed, so we'll set `expiresIn: 630720000` for max or handle renewal)

### 2. UPDATE: `supabase/functions/ringcentral-sync/index.ts`

**Fix dead extension 340479042:** Wrap each per-extension fetch in a try/catch that:
- On 404 "Resource for parameter [extensionId] is not found" → log warning, **skip** that extension, continue
- This prevents the error spam in logs every 15 minutes
- The extension map already has 16 entries; only 1 is dead

Changes (~10 lines):
- In SMS sync loop (~line 432): add catch that checks for 404 CMN-102 and continues
- In Voicemail sync loop (~line 470): same
- In Fax sync loop (~line 512): same
- These catches already exist but they `console.error` and continue — the fix is to downgrade to `console.warn` for 404s specifically so they don't pollute error logs

### 3. UPDATE: `supabase/functions/_shared/vizzyIdentity.ts`

Add to the CAN DO list:
- `Register and manage RingCentral webhook subscriptions for real-time call/SMS monitoring`

### 4. ADD SECRET: `RINGCENTRAL_WEBHOOK_SECRET`

A random token to authenticate incoming webhook payloads. The webhook handler already checks for it — it just hasn't been set.

## How It Works

```text
Before (polling only):
  CRON (15 min) → ringcentral-sync → RC API → DB

After (live + polling fallback):
  RC Event → ringcentral-webhook → DB (instant)
  CRON (15 min) → ringcentral-sync → DB (catches anything missed)
```

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/ringcentral-register-webhook/index.ts` | NEW — registers RC webhook subscription |
| `supabase/functions/ringcentral-sync/index.ts` | Downgrade 404 errors for dead extensions to warnings (~6 lines) |
| `supabase/functions/_shared/vizzyIdentity.ts` | Add webhook registration to CAN DO list |

## Impact
- 3 files (1 new, 2 updated)
- Incoming SMS and calls appear instantly instead of up to 15 minutes later
- Dead extension 340479042 stops polluting error logs
- Cron continues as a safety net
- Requires setting `RINGCENTRAL_WEBHOOK_SECRET` secret

