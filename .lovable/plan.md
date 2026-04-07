

# Fix: Vizzy SMS Reply Delay

## Root Cause Analysis

The SMS reply flow has **three layers of delay**:

### Layer 1: Webhook Pre-Processing (5-10s)
The `ringcentral-webhook` handler does 6 sequential DB operations (dedupe check, extension lookup, profile lookup, contact matching, communications upsert, activity event) **before** triggering `vizzy-sms-reply`. The AI reply doesn't even start until all this finishes.

### Layer 2: vizzy-sms-reply Sequential Operations (8-15s)
Inside `vizzy-sms-reply`, every operation runs sequentially:
1. Spam check (instant)
2. Rate limit DB query
3. Own numbers DB query
4. Contact context DB query
5. Conversation history DB query
6. **AI generation call** (2-5s alone)
7. RC token fetch + possible refresh
8. **RC phone number fetch** (API call every time — not cached)
9. SMS send
10. Communications insert

That's ~5 DB queries + 2 external API calls + 1 AI call — all in series.

### Layer 3: Webhook Unreliability (0-15 min)
If the webhook fails to fire, the fallback is the 15-minute cron sync. This is the worst-case scenario causing the longest delays.

## Fix Strategy

### 1. Trigger vizzy-sms-reply EARLIER in webhook
Move the fire-and-forget `vizzy-sms-reply` call to happen **immediately after** identifying the message as inbound SMS — before the upsert and activity logging. The reply doesn't depend on those DB writes.

### 2. Parallelize vizzy-sms-reply internals
Run independent operations concurrently using `Promise.all`:
- **Group A** (safety checks): rate limit query + own numbers query — run in parallel
- **Group B** (context + infrastructure): contact lookup + conversation history + RC token fetch — run in parallel with each other
- **Group C** (AI + phone): AI generation + RC phone number fetch — run in parallel (AI doesn't need the phone number, phone fetch doesn't need the AI response)

### 3. Cache RC phone number in DB
Store the SMS-capable phone number in `user_ringcentral_tokens` (already has `rc_phone_number` column). Skip the expensive RC API call if cached.

## Changes

### `supabase/functions/ringcentral-webhook/index.ts`
- Move the `vizzy-sms-reply` trigger to fire **immediately after** direction detection (before upsert/activity writes)
- Keep the rest of the webhook logic unchanged

### `supabase/functions/vizzy-sms-reply/index.ts`
- **Parallelize safety checks**: Run rate limit + own numbers queries via `Promise.all`
- **Parallelize context + token fetch**: Run contact lookup, conversation history, and RC token fetch concurrently
- **Parallelize AI + phone number**: Run the AI generation call and RC phone number fetch concurrently
- **Use cached phone number**: Check `rc_phone_number` from token row before calling RC API
- Net effect: ~3 sequential "stages" instead of ~10 sequential operations

## Expected Impact
Current: 15-25 seconds total (webhook processing + sequential vizzy-sms-reply)
After fix: 5-8 seconds total (early trigger + parallelized operations)

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/ringcentral-webhook/index.ts` | Move vizzy-sms-reply trigger earlier |
| `supabase/functions/vizzy-sms-reply/index.ts` | Parallelize operations, use cached phone number |

