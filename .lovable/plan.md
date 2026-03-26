

# Fix: Email Sending from ERP — ai@rebar.shop Token Missing

## Problem
The `notify-lead-assignees` function looks up `ai@rebar.shop` in `user_gmail_tokens` to send emails, but this account has never gone through the Google OAuth flow in the app, so no token exists. The env var fallback (`GMAIL_REFRESH_TOKEN`) is also expired → `invalid_grant`.

## Root Cause
The Google OAuth flow in the app (Integrations page → Connect Gmail) saves tokens keyed by the logged-in user's `user_id`. The `ai@rebar.shop` account needs to sign into the ERP and connect Gmail on the Integrations page to store a valid refresh token.

## Solution — Two-Part Fix

### Part 1: Immediate — Make the function resilient (code change)
Update `notify-lead-assignees` to fall back to **any admin user** who has a valid Gmail token if `ai@rebar.shop` has no token. This matches how `comms-alerts` and `email-activity-report` work.

**File:** `supabase/functions/notify-lead-assignees/index.ts`
- After failing to find `ai@rebar.shop` token, query `user_gmail_tokens` joined with `user_roles` for any admin user with a valid token
- Use that token to send emails (the email still appears "from" that Google account)
- This means `sattar@rebar.shop`'s token will be used immediately since it's the connected admin

### Part 2: Long-term — Connect ai@rebar.shop
You should sign into the ERP as `ai@rebar.shop` and go to **Integrations** → **Connect Gmail**. This will store a proper refresh token for the service account. Once done, the function will automatically prefer `ai@rebar.shop`'s token.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | Add admin fallback token lookup when ai@rebar.shop has no token |

