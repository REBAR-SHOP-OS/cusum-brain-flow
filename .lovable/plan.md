

## Plan: Register generate-video in config.toml and verify full logic

### Problem
The `generate-video` edge function exists with complete 3-tier fallback logic (Veo → Sora → Slideshow), but it is **not registered** in `supabase/config.toml`. This means the function may not deploy or may require JWT verification (which would block unauthenticated preflight requests).

### What's already working (no changes needed)
- **Edge function** (`supabase/functions/generate-video/index.ts`): Full 936-line implementation with Veo, Sora, slideshow fallback, multi-scene, progressive polling, library management
- **Client slideshow compiler** (`src/lib/slideshowToVideo.ts`): Ken Burns canvas-to-video rendering
- **UI** (`src/components/social/VideoGeneratorDialog.tsx`): Handles all modes including slideshow fallback
- **Secrets**: `GEMINI_API_KEY`, `GPT_API_KEY`, and `LOVABLE_API_KEY` are all configured
- **invokeEdgeFunction utility**: Properly fetches with auth headers

### Fix required

**File: `supabase/config.toml`** — Add the `generate-video` function registration with `verify_jwt = false` (the function handles auth manually via `verifyAuth()`):

```toml
[functions.generate-video]
verify_jwt = false
```

This single change ensures the function is properly deployed and accessible. The full 3-tier logic is already implemented end-to-end.

