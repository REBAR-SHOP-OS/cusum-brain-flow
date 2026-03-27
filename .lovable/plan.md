

# Fix: google-oauth Edge Function Boot Failure

## Problem
The `google-oauth` function fails to boot with `SyntaxError: Identifier 'supabaseAdmin' has already been declared` at line 50. This causes all Google integrations (Gmail, Calendar, Drive, etc.) to fail with "OAuth Error."

The screenshot also shows "Gmail sync appears stale" — a direct consequence of this broken function.

## Root Cause
Line 48 already destructures `serviceClient` as `supabaseAdmin` from the `handleRequest` context:
```typescript
const { userId, serviceClient: supabaseAdmin, body, req: originalReq } = ctx;
```
Then line 55-58 creates a **second** `const supabaseAdmin` — a duplicate declaration that crashes the function at boot time.

## Fix
**Delete lines 55-58** (the redundant `createClient` call). The `supabaseAdmin` from `ctx.serviceClient` is already the service-role client — it's the same thing.

## Files changed
- `supabase/functions/google-oauth/index.ts` — remove duplicate `supabaseAdmin` declaration (lines 55-58)

