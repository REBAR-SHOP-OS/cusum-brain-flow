# Story Icon → 9:16 Image + 9:16 Card

The pink/orange Story icon (the "5" Clapperboard button next to Add Card on `/social-media-manager`) triggers `generatePosts({ mode: "story", ... })`, which calls `auto-generate-post`. Server-side strict 9:16 enforcement already exists (memory rule + `cropToAspectRatioStrict`), but two surfaces still display Story images as square. This plan fixes both display surfaces and adds a regression test to lock the icon→9:16 contract.

## Scope (frontend display only — no business logic changes)

### 1. `src/components/social/PixelPostCard.tsx`
Image is hardcoded to `aspect-square` on line 112. Add Story awareness:
- Read `post.content_type` and switch the wrapper to `aspect-[9/16]` when `content_type === "story"`, else keep `aspect-square`.
- Use `max-w-[280px] mx-auto` on the image container in Story mode so the tall 9:16 frame doesn't blow out the card width.
- `object-cover` stays (image already strictly 1080×1920 from the server).

### 2. `src/components/social/SocialCalendar.tsx` (calendar grid cards)
Cards currently show no image thumbnail. Leave structure untouched — only add a small 9:16 badge/indicator? **No.** Out of scope; user's screenshot 2 is the *output* requirement, not a calendar tile change. Skip this file.

### 3. Regression test `tests/regression/social/story-icon-output-9x16.test.ts`
Static asserts to lock the contract for the Story icon path:
- `SocialMediaManager.tsx` Story popover still calls `generatePosts({ mode: "story" })`.
- `auto-generate-post/index.ts` still uses `cropToAspectRatioStrict(bytes, "9:16")` and `size: "1024x1792"` (already covered, but re-assert the icon path specifically).
- `PixelPostCard.tsx` switches to `aspect-[9/16]` when `content_type === "story"` and stays `aspect-square` otherwise.
- `PostReviewPanel.tsx` already wraps Story preview in `aspect-[9/16]` (verified at lines 845 and 1758) — re-assert.

## Out of scope (already correct or unrelated)
- Server image generation (`generate-image`, `auto-generate-post`, `regenerate-post`) — already strict 9:16, covered by `story-images-strict-9x16.test.ts`.
- `ensurePortrait` last-mile resampling to 1080×1920 — already in `imageWatermark.ts`.
- `PostReviewPanel` Story preview frame — already 9:16.
- Calendar tile layout, RLS, Neel Approval Gate, publish flow.

## Verification
1. Run `vitest run tests/regression/social/story-icon-output-9x16.test.ts` — passes.
2. Open `/social-media-manager`, click the Story "5" icon, pick date + product → newly created Story cards render in `PixelPostCard` (Pixel chat / approval panel) with a true 9:16 frame matching the reference image proportions.
