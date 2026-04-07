

# Fix: Add Spam Filter to SMS Alerts and Auto-Replies

## Problem
The screenshots confirm: CEO's phone is flooded with spam alerts (Pre-IPO scams from +18553365317, WhatsApp invites from +16478983690). Vizzy is also auto-replying to these spammers.

## Changes

### 1. NEW: `supabase/functions/_shared/spamFilter.ts`
Shared `isSpamSms(text, fromNumber)` function with:
- Keyword blocklist: "pre-ipo", "bonus shares", "whatsapp", "crypto", "bitcoin", "lottery", "act now", "click here", "unsubscribe", "opt out"
- Toll-free number detection: +1(855|888|877|866|800) prefixes
- URL-heavy messages (>2 URLs)

### 2. `supabase/functions/vizzy-sms-reply/index.ts`
Import `isSpamSms`, skip auto-reply if spam detected. ~5 lines.

### 3. `supabase/functions/ringcentral-webhook/index.ts`
Import `isSpamSms`, gate the `vizzy-sms-reply` trigger behind spam check. ~3 lines.

### 4. `supabase/functions/ringcentral-sync/index.ts`
Import `isSpamSms`, skip `sendCeoSmsAlert` for spam messages. ~3 lines.

## Impact
- 4 files (1 new, 3 updated)
- Spam still saved to DB for audit — just no alerts or replies
- No database or auth changes

