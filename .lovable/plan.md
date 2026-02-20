
# Fix Plan: Sattar Login Issue + Chat "Failed to Fetch"

## Issue 1: Sattar@rebar.shop Cannot Log In

### Root Cause
Sattar's account exists, is confirmed, and has admin role — the database is fine. The problem is with the Google OAuth login flow.

The Login page uses:
```typescript
const result = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: window.location.origin + "/home",
});
```

`window.location.origin` is dynamic. If Sattar is accessing via the **Preview URL** (`ef512187...lovableproject.com`) instead of the **Published URL** (`cusum-brain-flow.lovable.app`), the OAuth redirect_uri won't match what Google has registered as an authorized redirect URI — causing a silent failure or redirect to an error page.

Additionally, the `/chat` page routes through `useAdminChat`, which calls the `admin-chat` edge function. That function enforces an **admin-only role check**. Sattar has `admin` role in `user_roles`, so once logged in, chat will work for him.

### Fix for Sattar's Login
The fix is to ensure the Google OAuth redirect always uses the canonical published URL, not the dynamic origin. We update `Login.tsx` and `Signup.tsx` to use the published URL as the redirect_uri:

```typescript
// Before (dynamic, breaks on preview URLs):
redirect_uri: window.location.origin + "/home",

// After (canonical published URL):
redirect_uri: "https://cusum-brain-flow.lovable.app/home",
```

This ensures Google always redirects to the correct, registered domain regardless of which URL Sattar uses to access the login page.

---

## Issue 2: Chat "Failed to Fetch" on /chat

### Root Cause
The `useAdminChat` hook constructs the endpoint URL as:
```typescript
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-chat`;
```

The `admin-chat` edge function is only deployed and live in the **Test environment** until a successful publish completes. The migration blocker (now fixed) prevented edge functions from being deployed to Live. Once you publish now, the `admin-chat` function will deploy to Live and the URL will resolve correctly for all users.

However, there is a secondary issue: the `admin-chat` CORS headers are **incomplete**:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  // MISSING: x-supabase-client-platform, x-supabase-client-platform-version, etc.
};
```

The Supabase JS client (`supabase-js v2.95.2`) sends additional headers (`x-supabase-client-platform`, `x-supabase-client-runtime`, etc.) that are NOT listed in the CORS `Allow-Headers`. This causes the preflight OPTIONS request to be rejected, producing "Failed to fetch" in the browser.

### Fix for Chat
Update the `corsHeaders` in `supabase/functions/admin-chat/index.ts` to include the full set of Supabase client headers:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

This matches the standard CORS headers used in all other edge functions in the project (e.g., `app-help-chat`, `website-chat`).

---

## Files to Modify

| File | Change |
|---|---|
| `src/pages/Login.tsx` | Fix Google OAuth redirect_uri to use canonical published URL |
| `src/pages/Signup.tsx` | Same fix for Signup Google OAuth |
| `supabase/functions/admin-chat/index.ts` | Expand CORS headers to include full Supabase client header set |

## Sequence
1. Fix CORS headers in `admin-chat` and deploy edge function
2. Fix OAuth redirect URIs in Login/Signup pages
3. Publish — this will deploy the updated `admin-chat` to Live and clear the chat error

## Why This Is Safe
- No database changes required
- CORS header expansion is purely additive — no existing functionality broken
- OAuth redirect_uri change only affects users accessing via the preview URL (Sattar's specific scenario) — users already using the published URL are unaffected
- Sattar's admin role is already in the database, so once login works he will have full chat access
