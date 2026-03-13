

# Fix: `ringcentral-active-calls` Runtime Error

## Root Cause

Line 36 calls `userClient.auth.getClaims(token)` — this method does **not exist** in the Supabase JS client library. This causes a runtime crash on every invocation.

## Fix

### `supabase/functions/ringcentral-active-calls/index.ts`

Replace the `getClaims` call with `supabase.auth.getUser(token)` which is the correct API:

```typescript
// Before (broken):
const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
if (claimsError || !claimsData?.claims?.sub) { ... }
const userId = claimsData.claims.sub as string;

// After (correct):
const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
if (userError || !user) { ... }
const userId = user.id;
```

Use `supabaseAdmin` (service role) for `getUser()` — this is more reliable and avoids the need for a separate `userClient`. The `userClient` variable can be removed entirely.

