## Goal
Force every image produced from the Social Media Manager to be 9:16 (vertical portrait). Square (1:1) output is forbidden in all paths — story generation, post generation, and post regeneration.

## Files to change

### 1. `supabase/functions/auto-generate-post/index.ts`
- **Story branch (line ~382)** — already requests 9:16 from `openai/gpt-image-2` at `1024x1536` (closest portrait OpenAI supports). After decoding the base64, run the bytes through `cropToAspectRatio(bytes, "9:16")` (from `_shared/imageResize.ts`) so the stored PNG is exactly 9:16, not 2:3.
- **Post branch (lines ~717 and ~766)** — Gemini ignores `size`, so prepend a hard 9:16 instruction to `fullPrompt`:
  > `MANDATORY OUTPUT FORMAT: 9:16 vertical portrait (1080×1920), taller than wide. NEVER square, NEVER landscape. The image MUST be portrait orientation.`
  Also crop the returned bytes with `cropToAspectRatio(bytes, "9:16")` before upload so the final file is guaranteed 9:16.

### 2. `supabase/functions/regenerate-post/index.ts`
- Change the default in `generatePixelImage` from `const aspectRatio = options?.imageAspectRatio || "1:1"` → `|| "9:16"` (line 104).
- In the IMAGE-ONLY prompt builder (line ~458) replace `"1:1 square aspect ratio, perfect for Instagram"` with `"9:16 vertical/portrait aspect ratio (1080×1920), perfect for Stories/Reels"`.
- Explicitly pass `imageAspectRatio: "9:16"` on both `generatePixelImage(...)` call sites (lines ~461 and ~741) so the default can never silently regress.
- The existing `cropToAspectRatio` call already enforces the ratio on the saved bytes — no change there beyond passing `"9:16"`.

## Out of scope
- Other surfaces that legitimately need landscape/square (AdDirector videos, VideoStudio thumbnails, generate-image generic edge function, ai-agent). Per the user's message this rule is about the Social Media Manager's generated post/story images.
- Existing posts already saved at 1:1 — not retroactively re-cropped.

## Verification
1. Open Social Media Manager → Auto-generate today (post mode) → confirm new card images render 9:16, not square.
2. Open a story card → Regenerate image → confirm 9:16.
3. Open any post → Regenerate image (image-only) → confirm 9:16.
4. Inspect a generated file in storage: dimensions should be vertical (height > width, ratio = 0.5625).
