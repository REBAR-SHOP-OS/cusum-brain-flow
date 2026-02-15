

# Fix Google Search Console Scope Issue

## Problem
Your Google account is already connected, but the token was obtained before Search Console scopes were added. The "Connect Google" button is hidden because the status shows "connected", so there's no way to re-authenticate with the updated scopes.

## Solution

### 1. Add "Reconnect Google" button when already connected (`SeoOverview.tsx`)

When `googleStatus === "connected"`, show a small "Reconnect" button next to the email. This calls the same `connectGoogle` function which triggers `prompt: "consent"` in the OAuth flow, forcing Google to re-issue a token with all scopes (including `webmasters.readonly`).

### 2. Add disconnect-then-reconnect flow (`SeoOverview.tsx`)

Add a "Reconnect" button that:
- First calls `google-oauth` with `action: "disconnect"` to clear the old token
- Then immediately triggers the OAuth flow again via `connectGoogle()`
- This ensures Google issues a fresh refresh token with ALL scopes listed in the `google-oauth` function (Gmail, Calendar, Drive, YouTube, Analytics, **Search Console**)

### 3. No edge function changes needed

The `google-oauth` function already requests `webmasters.readonly` scope and uses `prompt: "consent"` which forces a new consent screen. The scopes are correct -- the user just needs to go through the flow again.

## Technical Details

### File Modified

| File | Change |
|------|--------|
| `src/components/seo/SeoOverview.tsx` | Add "Reconnect" button visible when `googleStatus === "connected"`, which disconnects old token then re-triggers OAuth flow |

### Flow

```text
User clicks "Reconnect Google"
  -> Calls google-oauth disconnect (clears old token)
  -> Calls google-oauth get-auth-url (with all scopes including Search Console)
  -> Redirects to Google consent screen
  -> User approves all scopes
  -> Token saved with full permissions
  -> GSC sync now works
```

After reconnecting once, the Sync GSC button will work because the new token includes the `webmasters.readonly` scope.

