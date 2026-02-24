

## Fix: "Apply Mapping" Edge Function Non-2xx Errors

### Root Cause

The `manage-extract` edge function has **incomplete CORS headers** (line 7). It only allows `authorization, x-client-info, apikey, content-type` but the current Supabase JS SDK sends additional headers (`x-supabase-client-platform`, `x-supabase-client-platform-version`, etc.). This causes the browser's CORS preflight `OPTIONS` check to reject the request before it even reaches the function logic -- which also explains why there are **zero logs** for this function.

### Fix (1 file: `supabase/functions/manage-extract/index.ts`)

#### 1. Update CORS headers to match the standard

Replace the current incomplete headers:
```typescript
// BEFORE (line 6-8)
"Access-Control-Allow-Headers":
  "authorization, x-client-info, apikey, content-type",
```

With the full set used by all other edge functions in the project:
```typescript
// AFTER
"Access-Control-Allow-Headers":
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
```

This single change aligns the function with the CORS configuration used in every other edge function (e.g., `diagnostic-logs`, `quickbooks-oauth`, `_shared/auth.ts`).

### Why This Fixes It

The Supabase JS SDK (`@supabase/supabase-js@2.95`) now sends platform-identifying headers on every request. When the `OPTIONS` preflight response doesn't list them in `Access-Control-Allow-Headers`, the browser blocks the actual `POST` request entirely -- resulting in a network-level failure that appears as a non-2xx status code to the calling code.

### Verification

After deploying, the "Apply Mapping" button should successfully invoke the function and return the mapping results.

