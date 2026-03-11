

## Diagnosis: "Auto-generate today" Timeout & Related Issues

### Root Cause
The `auto-generate-post` edge function times out (default 60s limit) because it sequentially:
1. Calls `social-intelligence` (which itself fails with OpenAI 429 quota error)
2. Makes 3 AI text generation calls (one per platform)
3. Makes **15 image generation calls** (5 per platform, one-by-one)

This easily exceeds the 60-second wall clock limit. The "Failed to fetch" error is the client seeing the connection drop.

### Issues Found

1. **Timeout**: 15 sequential image generations take ~5-10 min total — far beyond the 60s limit
2. **OpenAI quota exhausted**: `social-intelligence` uses `callAI` with GPT provider, which returns 429 (quota exceeded). This is non-fatal but wastes time.
3. **No config.toml entries**: The function lacks `verify_jwt` configuration
4. **No client-side timeout handling**: `useAutoGenerate` doesn't handle network timeouts gracefully

### Fix Plan

**1. `supabase/functions/auto-generate-post/index.ts`** — Skip image generation during auto-generate (generate text-only posts, images added later via Pixel agent or manual upload):
- Remove the 50-line image generation loop (lines 264-330)
- Set `imageUrl = null` for all posts — images will be generated separately
- This reduces the function to ~3 AI calls (one per platform), completing in ~15-20 seconds

**2. `supabase/functions/auto-generate-post/index.ts`** — Handle `social-intelligence` 429 gracefully:
- The `fetchBusinessIntelligence` already returns `""` on failure, so this is OK
- Add a quick timeout (5s) to prevent it from blocking

**3. `src/hooks/useAutoGenerate.ts`** — Add timeout + better error messaging:
- Add AbortController with 55-second timeout
- Show descriptive toast on timeout

**4. `supabase/config.toml`** — Cannot edit (auto-managed), but the function already handles auth manually via `verifyAuth()`, so this is fine.

### Summary
The core fix is removing inline image generation from the auto-generate flow. Posts will be created as text-only drafts with `image_url: null`, and images can be generated separately (via the existing Pixel agent "regenerate image" feature). This makes the function complete in ~20 seconds instead of timing out.

