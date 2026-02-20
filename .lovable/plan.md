
# Fix: /chat "Failed to Fetch" — Root Cause is OpenAI API Quota Exhaustion

## Confirmed Root Cause

The error on the `/chat` page is **NOT** a network or CORS issue. Direct testing of the `admin-chat` edge function confirmed:

```
429 — "You exceeded your current quota, please check your plan and billing details"
```

The `GPT_API_KEY` (OpenAI) stored in the project secrets has **exceeded its billing limit**. Every message sent from `/chat` triggers a call to the OpenAI API, which immediately returns a 429, causing the frontend to display "⚠️ Error: AI API error: 429...".

The CORS fix from the previous session was correct and necessary, but the underlying blocker is the exhausted OpenAI quota.

## Why It's Showing as "Failed to Fetch"

The `useAdminChat` hook catches the edge function's 400/500-style errors and formats them as:
```
⚠️ Error: AI API error: 429 — { "error": { "code": "insufficient_quota" } }
```

This appears in the chat bubble after the user's green "hi" message — exactly as described.

## Current AI Routing Logic

The `aiRouter.ts` file routes requests by default to GPT:
- Simple messages → `gpt-4o-mini` (GPT) — **FAILS with 429**
- Complex/accounting → `gpt-4o` (GPT) — **FAILS with 429**
- Briefings → `gemini-2.5-pro` — **WORKS** (GEMINI_API_KEY is configured and valid)

## The Fix: Make Gemini the Default Fallback

Since `GEMINI_API_KEY` is already configured and working, the simplest fix is to update `aiRouter.ts` so that:

1. **Default fast model** → `gemini-2.5-flash` (Gemini) instead of `gpt-4o-mini`
2. **Complex reasoning** → keep trying GPT first, but fall back to `gemini-2.5-pro` on 429
3. **The `callAIStream` function** → add automatic 429 fallback to Gemini (currently missing)

This makes the system resilient: GPT is tried first when available, Gemini handles everything when GPT quota is exhausted.

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/_shared/aiRouter.ts` | Switch default model to Gemini, add 429 fallback to `callAIStream` |

## Technical Detail

The `callAIStream` function (used for streaming responses in the chat) currently has **no fallback logic** — unlike `callAI` which does have a `fallback` option. When GPT returns 429 on a streaming call, the error propagates directly. The fix adds a retry-with-Gemini path for 429 errors in the streaming path.

### Updated `selectModel` defaults

```typescript
// Before (broken — GPT quota exhausted):
return { provider: "gpt", model: "gpt-4o-mini", ... };

// After (resilient — Gemini as default):
return { provider: "gemini", model: "gemini-2.5-flash", ... };
```

### Updated `callAIStream` with fallback

```typescript
export async function callAIStream(opts): Promise<Response> {
  try {
    return await _callAIStreamSingle(provider, model, opts);
  } catch (e) {
    if (e instanceof AIError && e.status === 429) {
      // Auto-fallback to Gemini on quota error
      return await _callAIStreamSingle("gemini", "gemini-2.5-flash", opts);
    }
    throw e;
  }
}
```

## Why This Is Safe

- `GEMINI_API_KEY` is already configured and confirmed working (briefing calls succeed)
- Gemini 2.5 Flash is faster and cheaper than GPT-4o-mini for simple queries
- GPT is still tried first for complex reasoning tasks — if/when the OpenAI billing is resolved, GPT resumes automatically
- No database changes required
- No frontend changes required
- After deploying the updated edge function, the chat will work immediately without requiring a publish
