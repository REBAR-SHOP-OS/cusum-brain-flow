

# Fix: Enforce Style, Product, and Aspect Ratio in Agent Image Generation

## Problem
When the user selects Style, Product, and Size (aspect ratio) via the toolbar pills and asks the Pixel agent to generate an image:
1. **Style/Product**: Already enforced at the prompt level, but the agent sometimes ignores them
2. **Aspect Ratio**: Only injected as a text instruction in the prompt — the Gemini image API doesn't receive actual resolution parameters. The `generatePixelImage` function (auto-gen path) correctly maps ratios to OpenAI sizes, but `agentToolExecutor.ts` (agent tool-call path) does NOT

## Changes

### 1. `supabase/functions/_shared/agentToolExecutor.ts` — Add real aspect ratio enforcement

In the `generate_image` handler (around line 717), after building `contentParts`, add the aspect ratio as a stronger prompt instruction AND map it to the system message to guide the model's output dimensions:

```typescript
// After line 611 (aspect ratio injection)
// Add stronger aspect ratio enforcement
const AR_PROMPT_MAP: Record<string, string> = {
  "16:9": "CRITICAL: Generate a LANDSCAPE image with 16:9 aspect ratio. The image MUST be wider than tall.",
  "9:16": "CRITICAL: Generate a PORTRAIT image with 9:16 aspect ratio. The image MUST be taller than wide (suitable for Instagram Stories/Reels).",
  "1:1": "CRITICAL: Generate a perfectly SQUARE image with 1:1 aspect ratio. Width and height MUST be equal.",
};
if (aspectRatio && AR_PROMPT_MAP[aspectRatio]) {
  imagePrompt += `\n\n${AR_PROMPT_MAP[aspectRatio]}`;
}
```

Also, in the API call body (line 723), add an explicit `aspect_ratio` field for Gemini models that support it:

```typescript
body: JSON.stringify({
  model: attempt.model,
  messages: [{ role: "user", content: contentParts }],
  modalities: ["image", "text"],
  // Gemini native aspect ratio support
  ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
}),
```

### 2. `supabase/functions/_shared/agentToolExecutor.ts` — Add `aspect_ratio` to tool args

Add an `aspect_ratio` parameter to the `generate_image` tool definition in `agentTools.ts` so the agent can explicitly pass it:

```typescript
aspect_ratio: { type: "string", description: "Image aspect ratio: '16:9' (landscape), '1:1' (square), or '9:16' (portrait/story). MUST match user's size selection." }
```

### 3. `supabase/functions/_shared/agentToolExecutor.ts` — Merge tool args aspect ratio with context

In the handler, prioritize the tool arg over context:
```typescript
const aspectRatio = args.aspect_ratio || (context?.imageAspectRatio as string) || "1:1";
```

### 4. `supabase/functions/ai-agent/index.ts` — Add aspect ratio to style override instructions

In the `socialStyleOverride` block (line 965), add aspect ratio instruction:
```typescript
socialStyleOverride += `REQUIRED ASPECT RATIO: ${context.imageAspectRatio || "1:1"}. Pass this as the aspect_ratio parameter when calling generate_image.\n`;
```

### 5. `supabase/functions/_shared/agents/marketing.ts` — Strengthen prompt

Add to the short-command section and main rules:
```
5. Pass the aspect_ratio parameter matching the user's size selection (16:9, 1:1, or 9:16)
```

### Summary
- Add `aspect_ratio` parameter to `generate_image` tool definition
- Inject stronger aspect ratio instructions into the image prompt
- Pass `aspect_ratio` in the Gemini API body for native support
- Instruct the agent to always pass aspect ratio from user selection
- Redeploy `ai-agent` edge function

