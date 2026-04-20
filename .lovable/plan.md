

# Why AI extraction is failing — diagnosis & fix

## Root cause (confirmed from edge function logs)

Every extraction attempt for session `2e46fa03-5f87-4e5b-b5cb-53b7a5cc3670` (file `Cages.xlsx`) fails with the **exact same upstream error**:

```
AIError: AI API error: 429
{
  "code": 429,
  "message": "Your prepayment credits are depleted. Please go to AI Studio
              at https://ai.studio/projects to manage your project and billing.",
  "status": "RESOURCE_EXHAUSTED"
}
```

Source: `supabase/functions/extract-manifest/index.ts` line 418 → `_callAISingle` in `aiRouter.ts` line 127.

**This is not a code bug.** The Google Gemini API key (`GEMINI_API_KEY`) used by `aiRouter.ts` has run out of prepaid credits. Every single extraction attempt in the last few minutes returned the same `RESOURCE_EXHAUSTED` response from Google.

## Why it doesn't auto-recover

`extract-manifest` calls `callAI({ provider: "gemini", model: "gemini-2.5-pro", ... })` **without a `fallback` option**.

`aiRouter.ts` has built-in fallback logic at line 128:
```ts
if ((e.status === 429 || 503 || 504) && opts.fallback) {
  // route to fallback provider
}
```

But because `extract-manifest` never sets `fallback`, the 429 from Gemini bubbles straight up as a 500 to the frontend. The user sees "Extraction failed."

## Two-part fix

### Part A — Immediate (user action, outside the codebase)
**Top up the Google AI Studio account** at https://ai.studio/projects. This unblocks every Gemini-backed extraction immediately. No deploy needed.

### Part B — Resilience (small code change, prevents future outages)
Add a GPT fallback to the `callAI` invocation in `extract-manifest/index.ts` so the next time Gemini quota is exhausted, the system silently rotates to OpenAI instead of failing.

**One-line change** at line ~397 in `supabase/functions/extract-manifest/index.ts`:

```ts
const aiResult = await callAI({
  provider: "gemini",
  model,                       // gemini-2.5-pro
  agentName: "estimating",
  messages: [...],
  temperature: 0.1,
  maxTokens,
  fallback: {                  // ← ADD THIS
    provider: "gpt",
    model: "gpt-5",            // strong vision + JSON; matches estimating workload
  },
});
```

That hooks into the existing fallback branch already in `aiRouter.ts` (no router changes). On 429/503/504 from Gemini, the request transparently retries on GPT-5, the user gets their extraction, and the audit log records `fallback`/`gpt`/`gpt-5` instead of a 500.

## Scope

**Changes:**
- `supabase/functions/extract-manifest/index.ts` — add a 4-line `fallback: { provider: "gpt", model: "gpt-5" }` block to the single `callAI` call at line ~397.

**Untouched:**
- `aiRouter.ts` (fallback logic already exists)
- `ai-estimate` and other functions (separate scope; can be hardened in a follow-up if you want the same pattern everywhere)
- DB, RLS, frontend hooks

## Validation

- ✅ Re-run extraction on `Cages.xlsx` → succeeds via either Gemini (after top-up) or GPT-5 (via new fallback)
- ✅ Edge function logs show `policy:fallback` entry instead of `error-final`
- ✅ No regression: when Gemini returns 200, GPT is never called (fallback only fires on 429/503/504)
- ✅ Cost-aware: GPT-5 is invoked **only** as a backup, not as primary — matches `mem://architecture/ai-routing-cost-strategy`

## Note on cost strategy

This change is consistent with the workspace's AI cost rule (Gemini-first, GPT only as fallback). It does NOT downgrade gemini-2.5-pro to flash — the heavy reasoning model stays primary; GPT-5 only kicks in on quota exhaustion or upstream outage.

