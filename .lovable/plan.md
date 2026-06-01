# Plan — Let user pick image aspect ratio before generating Story cards

## Scope
The popover in the screenshot (pink/orange Clapperboard button, "5" badge) on `/social-media-manager`. Today it has two steps:
1. Pick a date
2. Pick a product → immediately generates 5 cards at hard‑locked 9:16

The user wants an extra step where they choose the dimensions of the image that the LLM will generate.

## UX change (only this popover)
New 3‑step flow inside `StoryBannerReferences` popover in `src/pages/SocialMediaManager.tsx`:

```text
Step 1 · Pick a date      (unchanged)
Step 2 · Pick image size  ← NEW
Step 3 · Pick a product   (was Step 2)
```

Step 2 options (vertical list, same visual style as Step 2 today):
- 9:16 — Story / Reel (default, pre-selected)
- 1:1  — Square (Feed)
- 4:5  — Portrait (Feed)
- 16:9 — Landscape

"← Back" returns to the previous step. Selecting an option advances to the next step; the product list only triggers generation on click as it does today.

No changes to: Add Card (blue), Approved posts, Brand Kit, calendar grid, post cards, PostReviewPanel, publish flow, Neel approval gate.

## Data flow
1. `useAutoGenerate.generatePosts` gains an optional `aspectRatio?: "9:16" | "1:1" | "4:5" | "16:9"` (default `"9:16"` when `mode === "story"`, else unchanged).
2. It is forwarded in the edge-function body as `aspectRatio`.
3. `supabase/functions/auto-generate-post/index.ts`:
   - Map ratio → image size for the gateway call:
     - 9:16 → `1024x1792`
     - 1:1  → `1024x1024`
     - 4:5  → `1024x1280`
     - 16:9 → `1792x1024`
   - Pass that ratio into `cropToAspectRatioStrict(..., aspectRatio)`.
   - `assertStoryDimensions` is renamed to `assertImageDimensions(bytes, expectedWxH)` and validates against the chosen ratio's exact pixel size; on mismatch the slot still fails (null images are still deleted, per existing hard gate).
4. `content_type` stays `"story"` only when the chosen ratio is `9:16` (preserves the Story display + publish path). For 1:1 / 4:5 / 16:9 the placeholder rows are inserted with `content_type: null` (regular post) so `PixelPostCard` / `PostReviewPanel` render them as standard square/landscape cards — no UI changes needed there.

## Hard-rule check
- HARD: "AI Video Director videos must be silent." — unaffected, this is image generation only.
- HARD: Story 9:16 enforcement — preserved: when the user picks 9:16 the existing strict crop + dimension assertion + Story rendering path runs unchanged. Other ratios are treated as regular posts, not Stories, so the Story contract is not loosened.
- HARD: Neel approval gate — unaffected.

## Regression test
Update `tests/regression/social/story-icon-output-9x16.test.ts` (or add a sibling `story-icon-aspect-ratio.test.ts`) to lock:
- Popover exposes the 4 ratio options.
- `generatePosts` forwards `aspectRatio` to the edge function.
- Edge function maps ratio → size and calls `cropToAspectRatioStrict` + `assertImageDimensions` with the matching dimensions.
- Picking 9:16 still writes `content_type: "story"`; other ratios write `content_type: null`.

## Files touched
- `src/pages/SocialMediaManager.tsx` — add Step 2 ratio picker, thread `aspectRatio` into `generatePosts`.
- `src/hooks/useAutoGenerate.ts` — accept + forward `aspectRatio`, set `content_type` based on ratio.
- `supabase/functions/auto-generate-post/index.ts` — generalize size + strict-crop + dimension assertion to the chosen ratio.
- `tests/regression/social/story-icon-output-9x16.test.ts` — extend coverage.

Out of scope: Add Card (blue) flow, manual `AI Image` regenerate dialog, video aspect handling, calendar layout.
