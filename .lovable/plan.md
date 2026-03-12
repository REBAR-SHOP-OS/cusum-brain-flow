

# Fix ad-director-ai Persistent Runtime Error

## Root Cause

The logs reveal the real issue — it's **NOT a CPU timeout**. The AI model returns `finish_reason: "error"` with empty content, and `callAIAndExtract` retries the **same failing model** 3 times before throwing. The error is specifically in `handleWriteCinematicPrompt` (line 812 in compiled output).

The problem: `callAIAndExtract` (lines 223-247) only retries — it never tries the **fallback model**. Meanwhile, `callAI` (line 73) does have fallback logic for HTTP 5xx/429, but `finish_reason=error` comes back as HTTP 200 with broken content, so the fallback never triggers.

## Fix

### `supabase/functions/ad-director-ai/index.ts` — Add fallback model rotation to `callAIAndExtract`

Modify `callAIAndExtract` (lines 223-247) to:
1. On first retry failure, switch to the **fallback model** from the route instead of retrying the same model
2. Pass the route object (not just string) so it has access to `route.fallback`

```text
Attempt 0: primary model
Attempt 1: primary model (retry)  
Attempt 2: fallback model (different model)
```

Changes:
- **Lines 223-247**: Update `callAIAndExtract` to accept the full `ModelRoute` object, and on attempt 2, use `route.fallback` as `modelOverride`
- **Lines 586-593, 618-625, 643-650, 668-675**: Update all `callAIAndExtract` callers to pass the route object correctly (they already do — `MODEL_ROUTES[x]` is passed as 2nd arg)

The key fix is ~5 lines inside `callAIAndExtract`:
```typescript
// On last retry, switch to fallback model
const useModel = (attempt === MAX_RETRIES) ? (model as ModelRoute).fallback : undefined;
```

### Files Changed
- `supabase/functions/ad-director-ai/index.ts`

