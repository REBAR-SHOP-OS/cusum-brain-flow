

## Plan: Fix Wincher Sync Error

### Root Cause
The `wincher-sync` edge function was **not deployed** (returned 404). I've already deployed it. After deployment, testing revealed the Wincher API rejects the stored token with "Invalid token" (401).

### What's Already Fixed
- **Edge function deployed** -- `wincher-sync` is now live and reachable.

### Remaining Issue: Invalid Wincher API Token
The `WINCHER_API_KEY` secret exists but the value is being rejected by Wincher's API. You need to:

1. Go to [Wincher Personal Access Tokens](https://www.wincher.com/account/personal-access-tokens)
2. Generate a new token (or copy the correct one)
3. I'll update the secret with the correct value

### Implementation
- Update the `WINCHER_API_KEY` secret with the correct token value
- No code changes needed -- the function and frontend hook are already correct

