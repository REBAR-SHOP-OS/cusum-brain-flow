

# Fix: Add 5xx Retry to Prevent Transient Edge Function Boot Failures (546)

## Root Cause Analysis

The screenshot shows `"Edge function ai-agent failed (546)"`. This is NOT about a missing `generate-social-posts` function — there is no such function in this project. The social post generation flows entirely through the `ai-agent` edge function with `agent: "social"`.

HTTP 546 is a Supabase edge runtime transient error (cold start failure, boot timeout, or resource exhaustion). The function is currently working fine (logs show successful image generation at 14:03-14:05 UTC today). The 09:15 AM failure was transient.

**The gap:** `invokeEdgeFunction.ts` already has `retries: 1` configured for `ai-agent`, but the retry logic (line 66) only retries on `AbortError`, `Failed to fetch`, or `NetworkError`. A 546 response is a successful HTTP response (not a network error), so it is NOT retried — the user sees the error immediately.

## Fix

### `src/lib/invokeEdgeFunction.ts` — Add 5xx status codes to retryable conditions

Add a check: if `response.status >= 500`, treat it as retryable before throwing.

```typescript
// Line 49-51, after response.ok check:
if (!response.ok) {
  const errMsg = data?.error || `Edge function ${functionName} failed (${response.status})`;
  const err = new Error(errMsg);
  (err as any).status = response.status;
  throw err;
}

// Line 66, in isRetryable check:
const isRetryable = err.name === "AbortError" 
  || err.message?.includes("Failed to fetch") 
  || err.message?.includes("NetworkError")
  || (err as any).status >= 500;  // <-- NEW: retry on 5xx
```

## Files Changed

| File | Change |
|------|--------|
| `src/lib/invokeEdgeFunction.ts` | Add `status` property to error + include 5xx in retryable check (~3 lines) |

## Impact
- Transient 546/500/502/503 errors are automatically retried once (with backoff) before surfacing to the user
- No behavior change for non-5xx errors (auth failures, validation errors, etc.)
- No database, edge function, or UI changes
- Existing `retries: 1` in `agent.ts` is now effective for boot failures

