## Plan: enforce 9:16 for the Story icon path

### Goal
When the user clicks **Auto Generate Story** / the Story icon in Social Media Manager, the generated image must always be **vertical 9:16 portrait**. Square 1:1 images must never be accepted or saved.

### Root cause
There are two different story-generation paths:

1. **Batch story generation** via `auto-generate-post` already asks for 9:16, but its crop helper is lenient and can silently return the original square image if processing fails.
2. **The right-panel Story icon** uses `ImageGeneratorDialog` -> `generate-image`. This path can still produce square images because:
   - the fallback OpenAI branch hardcodes `size: "1024x1024"`
   - server-side crop only runs for data URLs in one branch
   - client-side `ensurePortrait()` can fail due remote/CORS issues and then falls back to the original square
   - failures are treated as warnings instead of hard blocks

### Changes to implement

#### 1. Add strict image ratio enforcement
File: `supabase/functions/_shared/imageResize.ts`
- Add `cropToAspectRatioStrict(bytes, "9:16")`.
- It will decode, crop/resize, then verify the final ratio.
- If decoding/cropping/verification fails, it throws instead of returning original bytes.
- Keep existing `cropToAspectRatio()` unchanged for other non-critical paths.

#### 2. Make Story batch generation strict
File: `supabase/functions/auto-generate-post/index.ts`
- Import and use `cropToAspectRatioStrict` for story images.
- Strengthen the story prompt to say **9:16 vertical portrait only, never square, never landscape**.
- If strict crop fails, do not upload the image; retry once.
- If both attempts fail, leave no image instead of saving a square.

#### 3. Make regenerate image strict for Social posts/stories
File: `supabase/functions/regenerate-post/index.ts`
- Use `cropToAspectRatioStrict` in image-generation upload paths.
- Any square/invalid image will be rejected before upload.

#### 4. Fix the actual Story icon path
File: `supabase/functions/generate-image/index.ts`
- When `aspectRatio === "9:16"`, prepend a hard mandatory 9:16 instruction to the prompt.
- In the Gemini path, run strict server-side 9:16 crop/validation for generated image bytes.
- In the OpenAI fallback path, use portrait size (`1024x1536`) instead of `1024x1024`, then strict crop/validation before returning.
- If strict validation fails, return an error; never return a square image.

#### 5. Stop client-side silent fallback for Story mode
File: `src/components/social/ImageGeneratorDialog.tsx`
- For `storyMode`, if `ensurePortrait()` fails, show an error and do not let the user use/save the image.
- Keep non-story image generation behavior unchanged.

#### 6. Add regression coverage
Add a regression test under `tests/regression/social/` that checks:
- `generate-image` no longer has `size: "1024x1024"` for the 9:16/OpenAI story path.
- Story/generate paths use strict crop enforcement for `9:16`.
- The Story dialog sends `aspectRatio: "9:16"` and does not silently accept failed portrait enforcement.

### Validation
- Run the targeted regression test.
- Re-read touched files to confirm there is one clear story 9:16 enforcement path and no leftover square fallback.

### Out of scope
- Existing already-saved square images will not be retroactively changed.
- Regular non-story feed/ad image generation can remain square where intentionally requested.