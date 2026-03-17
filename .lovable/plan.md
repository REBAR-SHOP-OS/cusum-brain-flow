

# Fix: Honor User's LLM Selection for Image Generation

## Problem
When the user selects "ChatGPT" in the model picker, the **text** generation correctly routes to GPT-4o (line 1007), but the **image** generation in the `generate_image` tool (agentToolExecutor.ts lines 699-702) always uses Gemini models. The `preferredModel` value is never passed into `mergedContext`, so the tool executor cannot see it.

This is why the agent apologizes instead of generating — when ChatGPT is selected, the GPT text model asks the tool to generate an image, the tool uses Gemini which may fail, and the GPT model then fabricates an excuse about aspect ratios.

## Root Cause
In `ai-agent/index.ts` line 497:
```typescript
const mergedContext = { ...dbContext, ...execContext, ...userContext };
```
`preferredModel` is a top-level request field, not part of `userContext`, so it never enters `mergedContext`. The tool executor receives `mergedContext` as `context` but has no `context.preferredModel`.

## Fix (2 files, ~20 lines)

### 1. `supabase/functions/ai-agent/index.ts`
After line 497 (`mergedContext` construction), inject `preferredModel`:
```typescript
if (preferredModel) mergedContext.preferredModel = preferredModel;
```

### 2. `supabase/functions/_shared/agentToolExecutor.ts`
In the `generate_image` tool (around line 698), check `context.preferredModel` and add an OpenAI gpt-image-1 path **before** the Gemini attempts — identical to the pattern already used in `generatePixelImage` (ai-agent lines 260-316):

- If `context.preferredModel === "chatgpt"` and `GPT_API_KEY` exists → try `gpt-image-1` first with the correct size mapping
- On success → upload and return
- On failure → fall through to existing Gemini attempts

This mirrors the exact same OpenAI-first logic already implemented in `generatePixelImage` but currently missing from the tool executor path.

## Result
- User selects Gemini → image generated via Gemini (unchanged)
- User selects ChatGPT → image generated via OpenAI gpt-image-1, falls back to Gemini if OpenAI fails
- No more false "aspect ratio" apologies — real errors surface if generation truly fails

