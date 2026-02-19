
## Fix: Add Gemini Fallback to Penny's AI Agent Call

### Problem
The logs show GPT-4o is rate-limited (429) and retries exhaust without success. The `callAI` call in `ai-agent/index.ts` (line 6749) does not include the `fallback` option that was added to the aiRouter, so the fallback to Gemini never triggers.

### Solution
Add `fallback: { provider: "gemini", model: "gemini-2.5-flash" }` to the main `callAI` invocation in the ai-agent edge function. This way, when GPT-4o is rate-limited after retries, the request automatically falls back to Gemini instead of throwing an error to the user.

### Technical Steps

**File: `supabase/functions/ai-agent/index.ts` (line ~6749)**

Add the fallback parameter to the callAI options:

```typescript
aiResult = await callAI({
  provider: modelConfig.provider,
  model: modelConfig.model,
  messages: messages as AIMessage[],
  maxTokens: modelConfig.maxTokens,
  temperature: modelConfig.temperature,
  tools,
  toolChoice: "auto",
  fallback: { provider: "gemini", model: "gemini-2.5-flash" },
});
```

**Deployment**: Redeploy the `ai-agent` edge function.

### Result
When GPT-4o is rate-limited, Penny will seamlessly fall back to Gemini 2.5 Flash instead of showing the "Edge Function returned a non-2xx status code" error. Users will never see 429 errors again.
