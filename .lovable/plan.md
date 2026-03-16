

# Fix: Video Caption Generation 503 Error (Root Cause)

## Problem
When regenerating captions for video posts, the `regenerate-post` edge function fails with a 503 error. The caption-only path uses **only one model** (`google/gemini-2.5-flash`) with no fallback — unlike the full regeneration path which rotates through multiple models.

## Root Cause
Line 349: caption-only mode hardcodes `google/gemini-2.5-flash`. If that model is temporarily unavailable (503), the 3 retries all hit the same unavailable model and fail. The full regen path (line 428) already rotates through `["google/gemini-2.5-flash", "openai/gpt-5-mini"]`.

## Solution (Hybrid Approach)

### 1. `supabase/functions/regenerate-post/index.ts` — Caption-only: add model rotation + video context
- Replace the single-model retry loop (lines 342-364) with a model rotation loop like the full regen path
- Models: `["google/gemini-2.5-flash", "google/gemini-3-flash-preview", "openai/gpt-5-mini"]`
- For video posts: use the existing `video-to-social` function's approach — send video metadata to generate a contextual caption, with fallback to general brand caption if all models fail

### 2. `src/components/social/PostReviewPanel.tsx` — Smarter video caption flow
- For video posts, first attempt `video-to-social` (which already exists and handles video context)
- If that fails, fall back to `regenerate-post` with `caption_only: true, is_video: true`
- Apply to both the "Regenerate caption" button (line 590) and the auto-caption on video upload (line 214)

### Key Changes

**`regenerate-post/index.ts`** (caption-only section, ~lines 342-364):
```typescript
// Replace single-model with rotation
const captionModels = ["google/gemini-2.5-flash", "google/gemini-3-flash-preview", "openai/gpt-5-mini"];
let capRes: Response | null = null;
for (const model of captionModels) {
  console.log(`[regenerate-post] Caption-only trying model: ${model}`);
  capRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: contentParts }] }),
  });
  if (capRes.ok) break;
  const errBody = await capRes.text();
  console.error(`[regenerate-post] Model ${model} failed (${capRes.status}): ${errBody}`);
  capRes = null;
}
if (!capRes) throw new Error("Caption generation failed — all models returned errors");
```

**`PostReviewPanel.tsx`** — video caption with fallback:
```typescript
// Try video-to-social first for context-aware caption, fall back to regenerate-post
if (isVideo) {
  try {
    const videoData = await invokeEdgeFunction("video-to-social", {
      videoUrl: post.image_url, platform: post.platform, aspectRatio: "1:1"
    }, { timeoutMs: 60000 });
    // Use video-to-social result to update post...
  } catch {
    // Fall back to regenerate-post caption-only
    await invokeEdgeFunction("regenerate-post", { post_id: post.id, caption_only: true, is_video: true }, { timeoutMs: 120000 });
  }
}
```

This ensures video captions always succeed by: (a) trying video-specific analysis first, (b) rotating through 3 AI models, (c) falling back to general brand copy as last resort.

