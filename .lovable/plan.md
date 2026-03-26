

# Fix: Accept Quote Page 404 / Failure

## Root Cause — 3 Issues

### 1. Edge functions missing from `supabase/config.toml`
Both `quote-public-view` and `send-quote-email` are NOT listed in `config.toml`, so they default to `verify_jwt = true`. The public AcceptQuote page calls them without an auth JWT — requests get rejected with 401. The page then shows an error or falls through to 404-like behavior.

### 2. `APP_URL` hardcoded to wrong domain
The email "Review & Accept Quote" button links to `https://cusum-brain-flow.lovable.app/accept-quote/...` but the actual production domain is `https://www.crm.rebar.shop`. Customers clicking the link land on the Lovable preview domain instead of the real app.

### 3. `send-quote-email` auth handling for `accept_and_convert`
The `accept_and_convert` action is called from the public page without auth. Even with `verify_jwt = false`, the function needs to handle the case where no Authorization header exists (it currently passes the header to internal calls).

## Changes

### 1. `supabase/config.toml` — add both functions
```toml
[functions.quote-public-view]
verify_jwt = false

[functions.send-quote-email]
verify_jwt = false
```

### 2. `supabase/functions/send-quote-email/index.ts` — fix APP_URL
Change:
```ts
const APP_URL = "https://cusum-brain-flow.lovable.app";
```
To:
```ts
const APP_URL = "https://www.crm.rebar.shop";
```

Also ensure the `accept_and_convert` action uses the service role key for internal calls (not the incoming auth header, which will be empty for public callers).

### 3. Deploy both edge functions
- Redeploy `quote-public-view` and `send-quote-email`

## Files Changed
- `supabase/config.toml`
- `supabase/functions/send-quote-email/index.ts`

