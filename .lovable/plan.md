

# Fix: Google OAuth Login Not Working

## Root Cause

In `src/lib/auth.tsx`, when the user returns from the Google OAuth flow, the code detects an OAuth callback (hash contains `access_token`) and immediately **clears ALL `sb-*` localStorage entries** (lines 56-58). This wipes out the fresh session tokens that the Lovable auth-bridge just set, so the user never gets logged in despite Google authentication succeeding.

The auth logs confirm this: multiple successful Google OIDC logins (status 200 on `/token`) for `radin@rebar.shop`, immediately followed by 403 "missing sub claim" errors — the cleared tokens leave the client with no valid session.

## Fix

### File: `src/lib/auth.tsx`

1. **Remove the aggressive localStorage clearing** in the `isOAuthCallback` block (lines 54-58). The comment says "clear stale tokens so they don't race with fresh OAuth tokens", but it actually destroys the fresh tokens that were just set by the auth-bridge.

2. **Keep the rest of the OAuth callback handling** (skip `getSession()`, rely on `onAuthStateChange` with `INITIAL_SESSION` allowed through, 5s safety timeout). This is correct — we just need to stop wiping the tokens.

### Summary
One targeted change in `auth.tsx`: delete 3 lines that clear `sb-*` localStorage during OAuth callbacks. Everything else stays the same.

