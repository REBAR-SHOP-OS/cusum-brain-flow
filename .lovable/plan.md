

# CEO SMS Alerts + Push Notification Status Check

## What the CEO Wants

1. **Vizzy should auto-reply to the CEO via SMS** at +14165870788 when she takes actions or has updates
2. **Push notifications status check** — confirm they're working
3. **On every inbound call or SMS, text the CEO** on their personal phone number
4. **Team Hub push notifications** should also be active

## Current State

- **Push notifications**: Already implemented — `push-on-notify` edge function fires on every notification insert, `sw-push.js` handles display, `useNotifications` registers push subscriptions on load
- **SMS to CEO**: `rc_send_sms` tool exists in `admin-chat` but is only used on-demand (Vizzy doesn't auto-text the CEO)
- **Inbound call/SMS alerts**: `VizzyCallHandler` creates in-app notifications but never sends an SMS to the CEO's phone
- **Team Hub**: Push notifications already fire via the `notify-on-message` trigger

## Changes

### 1. `supabase/functions/push-on-notify/index.ts` — Add SMS Alert to CEO

After sending the push notification, add logic to also send an SMS to the CEO's phone (+14165870788) for high-priority notification types:
- `call_summary` (Vizzy took a call)
- `rfq_approval` (RFQ captured)
- `callback_request` (someone wants a callback)
- Any notification with `priority: "high"`

Uses the same RingCentral SMS sending pattern already in `admin-chat` (fetch token from `user_ringcentral_tokens`, auto-detect SMS sender number, send via RC API).

SMS format: Short summary — e.g. "📞 Vizzy took a call from John Smith (Sales mode). RFQ captured for 20M rebar. Check app for details."

~50 lines added.

### 2. `supabase/functions/ringcentral-sync/index.ts` — SMS Alert on New Inbound SMS

After syncing a new inbound SMS to the database, send an SMS notification to the CEO at +14165870788:
- "📱 New SMS from [contact/number]: [first 100 chars of message]"
- Only for genuinely new messages (not already in DB)

~15 lines added in the SMS sync loop.

### 3. `supabase/functions/_shared/vizzyIdentity.ts` — Update Identity

Add to CAN DO list:
- "Auto-text the CEO at +14165870788 on every inbound call, SMS, or high-priority event"

Add directive:
- "When you complete a significant action or detect a critical event, always send an SMS summary to +14165870788 via rc_send_sms"

~5 lines added.

### 4. `supabase/functions/_shared/smsAlertHelper.ts` — NEW Shared Helper

Create a reusable helper function `sendCeoSmsAlert(message: string)` that:
- Fetches RC token from `user_ringcentral_tokens`
- Refreshes if expired
- Auto-detects SMS sender number
- Sends SMS to +14165870788
- Returns success/failure (never throws — alerts should not break primary flows)

This avoids duplicating the RC SMS logic across multiple functions. ~60 lines.

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/_shared/smsAlertHelper.ts` | NEW — reusable `sendCeoSmsAlert()` helper |
| `supabase/functions/push-on-notify/index.ts` | Add SMS alert to CEO for calls/RFQs/high-priority (~15 lines) |
| `supabase/functions/ringcentral-sync/index.ts` | SMS alert on new inbound SMS (~15 lines) |
| `supabase/functions/_shared/vizzyIdentity.ts` | Update CAN DO + add SMS alert directive (~5 lines) |

## Push Notification Status

Push notifications are already fully implemented:
- Service worker (`sw-push.js`) handles display
- `push-on-notify` sends push on every notification insert
- `useNotifications` auto-registers push subscription on page load
- Team Hub messages trigger push via `notify-on-message`
- VAPID keys are configured

The CEO just needs to have granted notification permission in their browser. No code changes needed for push.

## Impact
- 4 files (1 new, 3 updated)
- CEO gets SMS on their phone for every call, inbound SMS, and critical event
- Push notifications already active — no changes needed
- No database or auth changes

