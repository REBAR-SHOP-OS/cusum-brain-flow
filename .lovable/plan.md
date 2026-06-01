## Problem

Story images are generated via `google/gemini-2.5-flash-image` in `supabase/functions/auto-generate-post/index.ts` (story mode, around lines 235–300). The prompt asks for "vertical 9:16", but Gemini's image model ignores aspect-ratio instructions in text and returns square (~1:1) images. That is why the Story cards on the calendar show square photos instead of 9:16.

## Fix (single file, edge function only)

In `supabase/functions/auto-generate-post/index.ts`, change **only** the `generateStoryImage` function to use OpenAI's image endpoint with an explicit portrait size, which is the reliable way to force vertical output through the Lovable AI Gateway.

Concretely:

1. Replace the `chat/completions` + `google/gemini-2.5-flash-image` call with a call to `https://ai.gateway.lovable.dev/v1/images/generations` using:
   - `model: "openai/gpt-image-2"`
   - `size: "1024x1536"` (true portrait, closest supported size to 9:16 — gpt-image-2 does not expose 1080x1920)
   - `quality: "low"`
   - `n: 1`
   - `stream: false` (we're on the server, we just need the final PNG)
   - `prompt`: the existing story prompt text, with the logo URL and brain reference URLs appended as plain text references (gpt-image-2 doesn't accept reference images in this endpoint, so we keep the textual brand description and drop the image_url parts that only Gemini supported).
2. Parse `data[0].b64_json`, decode to bytes, and reuse the existing upload-to-storage block (`images/story-<uuid>.png`) unchanged.
3. Keep the existing fallback / null-handling shape so the rest of the story flow (placeholder rows, DB update of `image_url`) stays identical.

Nothing else in the file changes — non-story branches (`mode !== "story"`) keep using Gemini and their current logic.

## Out of scope

- Frontend (`SocialMediaManager.tsx`, `useAutoGenerate.ts`) — no changes; the card UI already renders whatever `image_url` we save.
- Non-story image generation paths.
- Cropping/padding existing already-generated square stories — only future story generations will be 9:16.

## Verification

1. Open Social Media Manager → click the pink 5-Stories icon → pick a date and a product → wait for generation.
2. Open one of the new Story cards → the image preview in the right panel should be visibly portrait (taller than wide), roughly 2:3 / 9:16.
3. Storage check: new file under `social-media-assets/images/story-*.png` should be 1024×1536.
4. Old square stories from before the fix are expected to remain square — they are not regenerated.

## Technical note

`openai/gpt-image-2` supported sizes are `1024x1024`, `1024x1536`, `1536x1024`. `1024x1536` (2:3) is the closest available portrait — full 9:16 (1080×1920) is not exposed by the gateway today, but 2:3 renders correctly as a vertical story card and is what platforms like IG/FB Stories upscale cleanly. If exact 9:16 is required later, we'd add a server-side center-pad step, which is intentionally not included now to keep the change surgical.
