

## Fix: Upstream AI API 429 Rate Limit Handling

### Problem

The "Edge Function returned a non-2xx status code" error shown on Penny's chat is caused by OpenAI's GPT-4o API returning a 429 (rate limit) response. The current `aiRouter.ts` treats 429 as non-retryable and immediately throws, which surfaces the error to the user.

### Solution

Two changes:

1. **Add retry-with-backoff for upstream 429 errors** in `supabase/functions/_shared/aiRouter.ts`
   - Instead of throwing immediately on 429, retry up to 3 times with exponential backoff (2s, 4s, 8s)
   - Parse the `Retry-After` header from the upstream API if available and use it as the delay
   - Only throw after all retries are exhausted

2. **Add fallback model routing** in `aiRouter.ts`
   - If GPT-4o returns 429 after retries, automatically fall back to Gemini 2.5 Flash for the accounting agent
   - This ensures the user always gets a response even if one provider is rate-limited

### Technical Details

**File: `supabase/functions/_shared/aiRouter.ts`**

Update `fetchWithRetry` function (around line 145-190):

- Move the 429 check from the "non-retryable" section into the retry loop
- Add exponential backoff: wait `(attempt + 1) * 3000` ms before retrying on 429
- After exhausting retries on 429, throw the AIError as before
- Add a `fallbackProvider` option to `callAI` that tries an alternate model if the primary fails with 429

**File: `supabase/functions/ai-agent/index.ts`**

- No changes needed -- the aiRouter fix handles it transparently

### Deployment

Redeploy the `ai-agent` edge function after updating the shared router (it imports from `_shared/aiRouter.ts`).

