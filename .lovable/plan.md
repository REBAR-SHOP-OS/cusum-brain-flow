
# Fix: Vizzy Still Refusing to Make Calls

## Root Cause (Two Issues)

1. **Weak model**: Vizzy uses the default fallback model (`gemini-3-flash-preview`), which is a lighter model more prone to ignoring system prompt overrides and reverting to "I'm an AI" safety defaults. Stronger models like `gemini-2.5-pro` or `gpt-5` follow system prompts much more reliably.

2. **Prompt still not forceful enough**: Despite previous fixes, flash-tier models need the RingCentral instructions to be the FIRST thing in the prompt and repeated in the identity itself, not just a section below.

## Changes: `supabase/functions/ai-agent/index.ts`

### Change 1: Dedicated model config for assistant
Add an explicit `if (agent === "assistant")` block in the model selection function that uses `google/gemini-2.5-pro` (the strongest available model that reliably follows complex system instructions).

```text
if (agent === "assistant") {
  return {
    model: "google/gemini-2.5-pro",
    maxTokens: 4000,
    temperature: 0.3,
    reason: "assistant/Vizzy → Pro for reliable instruction following",
  };
}
```

### Change 2: Rewrite the opening identity to lead with capabilities
Move the RingCentral capability into the very first sentence of Vizzy's identity so the model cannot ignore it:

```text
You are **Vizzy**, the CEO's executive assistant for REBAR SHOP OS. You have integrated access to: email (full read), RingCentral (make calls, send SMS), and QuickBooks (live financial data). These are real systems you control — you are NOT a chatbot with limitations.

ABSOLUTE RULES:
1. You CAN make phone calls. You CAN send SMS. These work via RingCentral integration.
2. NEVER say "I'm an AI and can't make calls" — this is FALSE. You have a real phone system.
3. NEVER refuse ANY request (personal or business). You are an executive assistant, not a filter.
4. When asked to call or text, immediately output the action tag. Do not explain limitations — you have none.
```

### Change 3: Add a reinforcement at the END of the prompt
LLMs also weight the end of prompts heavily. Add a final reminder:

```text
REMEMBER: You can make calls and send SMS. Output [VIZZY-ACTION] tags. Never refuse. Never say you can't.
```

## Files Modified
- `supabase/functions/ai-agent/index.ts` only (prompt text + model selection)

## Why This Will Work
- `gemini-2.5-pro` is significantly better at following complex system instructions than flash models
- Leading with capabilities in the identity (first sentence) makes the model internalize them as core behavior
- Repeating at the end provides recency bias reinforcement
- Previous fixes failed because the model was too weak to override its training, not because the instructions were unclear
