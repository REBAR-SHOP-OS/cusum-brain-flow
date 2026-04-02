

# Fix: RingCentral OAuth Callback Unauthorized Error

## Root Cause

`ringcentral-oauth` uses `handleRequest` with default `authMode: "required"`. The OAuth callback is a browser GET redirect from RingCentral — no Bearer token. The `requireAuth()` call in the wrapper rejects the request before the handler's GET-detection code (line 35) ever executes.

## Fix

**File**: `supabase/functions/ringcentral-oauth/index.ts` (line 274)

Change `authMode` to `"optional"` in the handler options:

```typescript
{ functionName: "ringcentral-oauth", requireCompany: false, wrapResult: false, authMode: "optional" }
```

This allows:
- GET callback from RingCentral (no token) → proceeds to `handleOAuthCallback` which creates its own service client
- POST actions from the app (with Bearer token) → `userId` is resolved normally, existing `if (!userId)` guard at line 39 handles unauthorized POST requests

No other changes needed. The existing code already handles both paths correctly — it was just blocked by the wrapper.

## Verification
- User clicks "Connect RingCentral" → redirected to RC → RC redirects back → callback handler exchanges code → saves tokens → redirects to success page

