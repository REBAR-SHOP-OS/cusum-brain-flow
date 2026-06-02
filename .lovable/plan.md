# Story-only Regenerate icon (9:16 guaranteed)

## Goal
Add a small dedicated icon button on the post review panel that appears **only when the post's content type is Story**. Clicking it regenerates the image and guarantees the saved result is a 9:16 portrait (matching how the existing Story upload gate works).

## Why a new button (vs. fixing the existing one)
The current "Regenerate image" button calls `regenerate-post` with `image_only: true`. The edge function already prompts for 9:16, but it writes `image_url` directly to the DB — bypassing the frontend `ensurePortrait` gate that normal uploads go through. So a freshly regenerated story image can still land as square/landscape if the model ignores the prompt. The user wants a story-specific path that cannot fail this way.

## Scope (frontend only — surgical)
File: `src/components/social/PostReviewPanel.tsx`

1. Add a new icon-only button rendered **only when `isStory === true`**, placed next to the existing "Regenerate image" / "AI Image" row (around line 880–909). Icon: `Smartphone` + `RefreshCw` combo (or just `RefreshCw` with a "9:16" badge); tooltip: "Regenerate Story image (9:16)".
2. New handler `handleRegenerateStoryImage`:
   - `setRegenerating(true)`
   - Call `invokeEdgeFunction("regenerate-post", { post_id, image_only: true }, { timeoutMs: 120000 })`
   - Read back `image_url` from the response.
   - Run the existing `ensurePortrait(imageUrl)` from `@/lib/imageWatermark` (same helper already used in `handleMediaReady`).
     - If `ensurePortrait` returns a different (cropped/padded) blob, upload via `uploadSocialMediaAsset(..., "image")` and `supabase.from("social_posts").update({ image_url }).eq("id", post.id)`.
     - If `ensurePortrait` throws → toast "Story image rejected — not 9:16, try again" and keep the old image (do NOT save).
   - `queryClient.invalidateQueries({ queryKey: ["social_posts"] })`
   - Toast success on save.
3. Reuse existing `regenerating` state so the button shows a spinner and is disabled while running.

## Out of scope
- No edge function changes (prompt already says 9:16; the new gate is the safety net).
- No DB schema changes.
- No change to the existing "Regenerate image" button behavior for non-Story posts.

## Verification
- Open a Story post → new icon visible; non-Story post → icon hidden.
- Click on a Story post → spinner → new portrait image saved; if model returns square, `ensurePortrait` crops to 9:16 before save (or rejects with toast).
- Run `bunx vitest run tests/regression/social/story-images-strict-9x16.test.ts tests/regression/social/story-portrait-enforcement.test.ts` to confirm no existing story-9:16 regression test breaks.

Approve to implement.
