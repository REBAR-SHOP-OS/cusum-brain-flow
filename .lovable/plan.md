

# Fix: Image Generation Fails Due to Unsupported `aspect_ratio` API Parameter

## Problem
When the user selects `9:16` ratio and asks Pixel to generate an image (e.g., "یک عکس برای نوروز بساز"), the AI reports an `aspectRatio` parameter error instead of generating the image. The root cause is that the `aspect_ratio` field is being sent as a **top-level parameter** in the Lovable AI gateway request body (OpenAI-compatible API), which doesn't support this field. This causes the API to reject the request or return an error, and the AI model then reports the error to the user instead of retrying.

## Root Cause (line 733 in `agentToolExecutor.ts`)
```ts
body: JSON.stringify({
  model: attempt.model,
  messages: [...],
  modalities: ["image", "text"],
  ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),  // ← UNSUPPORTED FIELD
}),
```

The same issue exists in the 1:1 fallback block (line 825).

## Solution
Remove the `aspect_ratio` field from the API request body in both the primary and fallback generation paths. The aspect ratio is already handled via:
1. **Prompt-level instructions** (line 617: `AR_PROMPT_MAP` injects "CRITICAL: Generate a PORTRAIT image...")
2. **Server-side cropping** (line 776-778: `cropToAspectRatio()` enforces the exact ratio after generation)

These two mechanisms are sufficient — the top-level API parameter is both unnecessary and harmful.

## Changes

### `supabase/functions/_shared/agentToolExecutor.ts`
1. **Line 733**: Remove `...(aspectRatio ? { aspect_ratio: aspectRatio } : {})` from the primary generation request body
2. **Line 825**: Remove `aspect_ratio: "1:1"` from the fallback generation request body

Two lines changed, both removing the unsupported `aspect_ratio` field from the Lovable AI gateway request.

## Files
- **Edit**: `supabase/functions/_shared/agentToolExecutor.ts` (lines 733, 825)

