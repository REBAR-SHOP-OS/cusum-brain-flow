

# Fix Ad Director Analysis Timeout & Token Truncation

## Root Causes

1. **30s client timeout fires first** — `invokeEdgeFunction` (line 18 of `src/lib/invokeEdgeFunction.ts`) defaults to 30s. The 90s `withTimeout` wrapper in `AdDirectorContent.tsx` never gets a chance because the inner timeout kills the request first.

2. **Token budget too small** — The `analyze-script` route uses `maxTokens: 8192`. Gemini 2.5 Pro spends tokens on reasoning (visible in logs as `"reasoning": "**Planning the Storyboard**..."`), leaving insufficient tokens for the structured tool call output. The model returns `finish_reason: "length"` and the function throws "AI did not return structured data."

## Changes

### 1. `src/components/ad-director/AdDirectorContent.tsx`
Pass `timeoutMs: 90000` to `invokeEdgeFunction` calls so the 90s budget actually applies:
```typescript
invokeEdgeFunction("ad-director-ai", { ... }, { timeoutMs: 90_000 })
```

### 2. `supabase/functions/ad-director-ai/index.ts`
Increase `maxTokens` for `analyze-script` and `generate-storyboard` from `8192` to `16384` so the model has room for both reasoning and structured output.

### Files
- `src/components/ad-director/AdDirectorContent.tsx` — pass longer timeout to invokeEdgeFunction
- `supabase/functions/ad-director-ai/index.ts` — increase token budget for script analysis

