

# Fix: notify-lead-assignees to use ai@rebar.shop token from DB

## Problem
The function uses `GMAIL_REFRESH_TOKEN` env var directly, which is expired (`invalid_grant`). Other functions (comms-alerts, email-activity-report) correctly look up `ai@rebar.shop` in `profiles` → fetch token from `user_gmail_tokens` → refresh via OAuth.

## Fix
Refactor the email-sending section (lines 110–170) of `notify-lead-assignees/index.ts` to:

1. Look up `ai@rebar.shop` profile → get `user_id`
2. Fetch `refresh_token` from `user_gmail_tokens` (with decryption support)
3. Fall back to `GMAIL_REFRESH_TOKEN` env var only if no DB token exists
4. Handle token rotation (save new refresh token if Google issues one)

This matches the exact pattern used by `comms-alerts/index.ts` (lines 96–145).

### File Changed

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | Replace direct env var token usage with DB-based token lookup for `ai@rebar.shop`, matching `comms-alerts` pattern. Add `tokenEncryption` import. |

