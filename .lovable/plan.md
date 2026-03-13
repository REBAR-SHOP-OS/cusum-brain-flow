

# Fix LinkedIn OAuth Popup Not Closing

## Problem
The LinkedIn OAuth callback returns inline HTML with `<script>window.opener?.postMessage(...)` directly from the edge function. During the OAuth redirect chain (app → LinkedIn → Supabase edge function), browsers can lose the `window.opener` reference. This causes:
1. `window.close()` fails — popup stays open showing raw HTML
2. `postMessage` never reaches the parent — main page doesn't refresh status

## Root Cause
The callback HTML is served from the **Supabase domain** (`uavzziigfnqpfdkczbdo.supabase.co`), which is a different origin than the app (`erp.rebar.shop`). After multiple redirects, `window.opener` is often `null`, so the script silently fails.

## Solution
Instead of returning inline HTML, **redirect the popup back to the app's own callback page** (`/integrations/callback`) which already handles this correctly — it's on the same origin as the opener, so `window.opener.postMessage()` and `window.close()` both work reliably.

The `IntegrationCallback.tsx` page already supports `?status=success&integration=...&email=...` query params.

## Changes

### `supabase/functions/linkedin-oauth/index.ts`

**Success case (line 192-196):** Replace inline HTML response with a redirect:
```typescript
const appBase = returnUrl || "https://erp.rebar.shop";
const callbackUrl = new URL("/integrations/callback", appBase);
callbackUrl.searchParams.set("status", "success");
callbackUrl.searchParams.set("integration", "linkedin");
callbackUrl.searchParams.set("email", profileName);
return Response.redirect(callbackUrl.toString(), 302);
```

**Error case (line 116-119):** Same pattern — redirect instead of inline HTML:
```typescript
const callbackUrl = new URL("/integrations/callback", "https://erp.rebar.shop");
callbackUrl.searchParams.set("status", "error");
callbackUrl.searchParams.set("message", `Authorization denied: ${error}`);
return Response.redirect(callbackUrl.toString(), 302);
```

**Error thrown case:** Wrap the `handleCallback` catch to also redirect on error instead of returning JSON.

### Single file change
- `supabase/functions/linkedin-oauth/index.ts` — replace inline HTML responses with redirects to `/integrations/callback`

