

## Fix: Vizzy [STOP] Empty Response Bug

The `[STOP] I processed the data but couldn't generate a text response` error occurs because:

1. The AI model (gemini-2.5-flash) processes the massive context and returns **tool_calls without text content** → `reply = ""`
2. After tool execution, follow-up calls may also return empty content
3. The fallback at line 752 triggers, showing the [STOP] message

### Root Cause
The model is overwhelmed by the large context or only returns tool calls. There's no recovery mechanism to force a text response.

### Changes

**1. `supabase/functions/ai-agent/index.ts` (lines 750-754)** — Add a recovery call when reply is empty

After the tool loop ends with an empty reply, make one final AI call **without tools** (forcing text output) with a simplified prompt asking the model to synthesize its findings into a response:

```
if (!reply) {
  // Recovery: force text generation without tools
  const recoveryMessages = [
    ...messages,
    ...accumulatedTurns,
    { role: "user", content: "Please provide your complete analysis and response as text now. Synthesize all the data you've processed into a clear briefing." }
  ];
  
  const recoveryResult = await callAI({
    provider: modelConfig.provider,
    model: modelConfig.model,
    messages: recoveryMessages,
    maxTokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature,
    // No tools — forces text response
    fallback: { provider: "gemini", model: "gemini-2.5-pro" },
  });
  
  reply = recoveryResult.content || "";
}
```

This removes the `[STOP]` dead-end entirely. If the recovery also fails, the existing fallback message remains as a last resort.

**2. Redeploy `ai-agent` edge function**

### Technical Details
- The recovery call uses **no `tools` parameter**, which forces the model to respond with text content instead of tool calls
- The fallback escalates to `gemini-2.5-pro` (larger model, better at synthesizing large context)
- The accumulated tool results are preserved in the conversation, so the recovery call has all the data the model already fetched

