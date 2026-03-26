

# Send Emails From the Logged-In Actor's Gmail Account

## Problem
Currently, `notify-lead-assignees` always sends emails from `ai@rebar.shop` (or an admin fallback). The user wants emails to come **from the person who performed the action** — e.g., if `sattar@rebar.shop` logs a note, the email should be sent from `sattar@rebar.shop`'s Gmail account using their own OAuth token.

## Solution
Change the token lookup priority in `notify-lead-assignees`:

1. **First**: Look up the **actor's** Gmail token in `user_gmail_tokens` using `actor_id`
2. **Fallback**: If the actor has no token, try `ai@rebar.shop`
3. **Fallback 2**: Try any admin with a valid token
4. **Fallback 3**: Env var `GMAIL_REFRESH_TOKEN`

Also fetch the actor's email from `profiles` to use as the `From:` header instead of hardcoded `ai@rebar.shop`.

## Changes

### `supabase/functions/notify-lead-assignees/index.ts`

1. **Token lookup order** — Replace the current "ai@rebar.shop first" logic with:
   - Query `user_gmail_tokens` for `actor_id` first
   - If found, use actor's token and fetch actor's email from `profiles` for the `From:` header
   - If not found, fall through to existing ai@rebar.shop → admin → env var chain

2. **Dynamic `From:` header** — Replace hardcoded `From: ai@rebar.shop` (line 230) with the resolved sender email (actor's email when using their token, otherwise `ai@rebar.shop`)

3. **Token rotation** — Already handled; just ensure `senderUserId` is set to the correct user whose token was used

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | Actor-first token lookup + dynamic From header |

