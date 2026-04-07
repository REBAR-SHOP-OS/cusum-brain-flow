

# Fix: Vizzy SMS Still Not Responding

## Root Cause

**Line 4 of `ringcentral-webhook/index.ts`** calls `serve(async (req) => {` — but `serve` is never imported or defined. It should be `Deno.serve(async (req) => {`. This means the entire webhook handler has been dead since deployment. No inbound SMS or call events reach the system in real time.

Meanwhile, `ringcentral-sync` (the 15-min cron) successfully stores inbound SMS, but **never triggers `vizzy-sms-reply`**. So messages are saved but Vizzy never generates a reply.

## Changes

### 1. Fix `supabase/functions/ringcentral-webhook/index.ts`
- **Line 4**: Change `serve(async (req) => {` to `Deno.serve(async (req) => {`
- Add structured logging at entry point: webhook received, event type, SMS trigger fired/skipped

### 2. Add cron fallback in `supabase/functions/ringcentral-sync/index.ts`
In the SMS sync loop (around line 549), after a new inbound SMS is inserted (`status === 201`):
- Skip CEO's own number (already done)
- Skip spam (already done)
- **Add**: trigger `vizzy-sms-reply` for genuinely new inbound SMS as a catch-up path
- Fire-and-forget, same pattern as the webhook trigger
- This ensures replies happen even when the webhook is down

### 3. Improve logging in `supabase/functions/vizzy-sms-reply/index.ts`
- Add structured log at entry: from_number, isCeo, skip reason
- Log the specific reason when a reply is skipped (spam/dedupe/rate_limit/own_number/short_code)
- Already mostly there — just add an entry-point log so we can confirm invocations in edge function logs

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ringcentral-webhook/index.ts` | Fix `serve` → `Deno.serve`, add entry logging (~3 lines) |
| `supabase/functions/ringcentral-sync/index.ts` | Add vizzy-sms-reply trigger for new inbound SMS in cron (~15 lines) |
| `supabase/functions/vizzy-sms-reply/index.ts` | Add entry-point log (~2 lines) |

## Impact
- Webhook path restored — real-time SMS replies work again
- Cron fallback ensures replies even if webhook is temporarily down
- Better observability for debugging
- No database or auth changes

