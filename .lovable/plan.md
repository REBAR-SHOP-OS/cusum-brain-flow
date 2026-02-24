
# Fix: "Suggestion failed" Error Across the App

## Root Cause
The `ai-inline-suggest` edge function (line 60-62) is hardcoded to use `provider: "gpt"` with model `gpt-4o-mini`. Based on project history, **OpenAI API quotas are exhausted**, so every call returns a 429 or similar error. The function has **no fallback** to Gemini, unlike other edge functions in the project.

A secondary issue: the CORS `Access-Control-Allow-Headers` is missing newer Supabase client headers, which can cause preflight failures in some browsers.

## Fix (1 file)

### `supabase/functions/ai-inline-suggest/index.ts`

**Change 1 -- Switch to Gemini with GPT fallback (line 60-68):**
Replace:
```typescript
provider: "gpt",
model: "gpt-4o-mini",
```
With:
```typescript
provider: "gemini",
model: "gemini-2.5-flash-lite",
fallback: { provider: "gemini", model: "gemini-2.5-flash" },
```
This uses the cheapest/fastest Gemini model (appropriate for short suggestions) and falls back to the standard Flash model if rate-limited.

**Change 2 -- Fix CORS headers (line 6):**
Update `Access-Control-Allow-Headers` to include the full set of Supabase client headers:
```
authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

## Why This Fixes It
- The "Suggestion failed: Edge Function returned a non-2xx status code" error is caused by the OpenAI API rejecting calls (quota exhausted), which makes the function return HTTP 500
- Switching to Gemini (which is working for all other agents in the app) resolves the issue immediately
- The CORS fix prevents potential preflight failures with newer Supabase JS client versions
