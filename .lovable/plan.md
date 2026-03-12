

# Fix: "Analysis failed — Failed to fetch" in Ad Director

## Root Cause

The logs show a clear pattern:
1. GPT-5 rejects the `temperature` parameter (400 error: "Only the default (1) value is supported")
2. The temperature fallback retries without temperature — this adds a wasted round trip
3. The retry + actual generation exceeds the edge function timeout (~60s), causing "Http: connection closed before message completed"
4. The client sees "Failed to fetch" because the connection dropped

## Fix

**Eliminate the wasted retry** by not sending `temperature` for OpenAI models in the first place. This saves ~2-5 seconds per call.

### Changes to `supabase/functions/ad-director-ai/index.ts`

1. **In `callAI` (line ~83-88)**: Before building the request body, check if the model starts with `openai/`. If so, skip the `temperature` field entirely. This removes the need for the temperature fallback retry mechanism for OpenAI models.

```typescript
const body: any = {
  model,
  messages,
  max_completion_tokens: route.maxTokens,
};
// Only send temperature for models that support it (not OpenAI)
if (!model.startsWith("openai/")) {
  body.temperature = route.temperature;
}
```

2. **Keep the `sendWithTemperatureFallback` as safety net** — it still protects against future models that may reject temperature, but it won't fire in the normal path.

This is a one-line conditional addition that eliminates the double-request penalty causing the timeout.

