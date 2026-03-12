

# Fix: Analysis Fails Due to Reasoning Tokens Exhausting Token Budget

## Root Cause

Gemini 2.5 Pro uses "thinking/reasoning" tokens internally. These count against `max_completion_tokens: 8192`. The model spends ~6K+ tokens reasoning ("Planning the Storyboard...", "Structuring the Video...") before generating the actual structured output, then hits MAX_TOKENS and returns `content: null`. The fallback attempt then gets killed by the client timeout.

## Changes

### 1. `supabase/functions/ad-director-ai/index.ts` — Increase token budget for analyze-script

Increase `maxTokens` for `analyze-script` from **8,192 → 16,384** (restoring original value). The reasoning tokens need room. The previous reduction was counterproductive — it's what caused this failure.

Also change the API field from `max_completion_tokens` back to `max_tokens` — Gemini via the OpenAI-compatible endpoint treats `max_completion_tokens` as a hard cap on output tokens *including* reasoning, while `max_tokens` is more lenient on some providers.

### 2. `supabase/functions/ad-director-ai/index.ts` — Add `thinking` budget config

For Gemini 2.5 Pro, we can set `"thinking": { "thinking_budget": 4096 }` to cap reasoning tokens and leave room for actual output. This prevents the model from burning the entire budget on internal thought.

### 3. `src/components/ad-director/AdDirectorContent.tsx` — Client timeout already 180s

No change needed — 180s is sufficient if the model doesn't exhaust tokens.

## Summary of Token Budget Fix

```text
Before:  max_completion_tokens: 8192
         Model uses ~6K on reasoning → only ~2K left for output → truncated → FAIL

After:   max_tokens: 16384
         thinking_budget: 4096 (caps reasoning)
         Model uses ≤4K reasoning + up to 12K output → SUCCESS
```

## Files
- `supabase/functions/ad-director-ai/index.ts` — restore analyze-script to 16384 tokens, switch to `max_tokens`, add thinking budget for Gemini Pro models

