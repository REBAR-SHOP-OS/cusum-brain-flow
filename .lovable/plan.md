## Scope

Only the pink/orange **Clapperboard "5" icon** in the `/social-media-manager` header (the "Create 5 Story cards for a product" button). Everything else (AI Image button, Add Card, Auto Generate, manual uploads) stays untouched.

Two outcomes:

1. **Generation side** — guarantee every image produced from this icon is true 9:16 (1080×1920). It already aims for 9:16, but we'll add a hard server-side post-crop check so square/landscape fallbacks can never leak through.
2. **Display side** — when a post has `content_type = "story"`, the weekly calendar card in `SocialCalendar.tsx` must show the image thumbnail inside a real 9:16 frame instead of just the small status row.

No changes to: Manual Mode, RLS, workflow gates, Neel Approval Gate, AI Image dialog, regular post cards, video cards, schemas, or any other icon.

## Changes

### 1. `supabase/functions/auto-generate-post/index.ts` (story branch only, ~line 396–425)

- Already calls `cropToAspectRatioStrict(bytes, "9:16")`. Add a defensive verification step right after the crop: decode width/height and if ratio is not within ±1% of 9/16, throw and let the caller mark the placeholder as failed instead of saving a non-9:16 image. This makes "no 1:1 ever reaches the card" a hard contract.
- Keep `size: "1024x1792"` request, keep the existing `ABSOLUTE FIRST INSTRUCTION` prompt. No other prompt or model changes.

### 2. `src/components/social/SocialCalendar.tsx` (card render, ~line 332–399)

For a card where `post.content_type === "story"`:

- Render a 9:16 thumbnail block at the top of the card using `aspect-[9/16]` and `object-cover`:
  - If `post.image_url` exists and is an image → `<img>` inside the 9:16 box.
  - If it's a video URL → `<video muted>` poster frame inside the 9:16 box (respects Silent AI Videos rule).
  - If empty (placeholder "?" card) → muted skeleton box with the existing `?` badge centered.
- Keep the existing platform icon row, time, status text, and selection checkbox below the thumbnail — no other layout changes.
- Cap thumbnail width to the column width so the card itself stays inside the day column; the 9:16 ratio just sets the height.

Non-story cards render exactly as today (no thumbnail).

### 3. Regression test

`tests/regression/social/story-card-9x16-display.test.ts`:

- Render `SocialCalendar` with one `content_type:"story"` post and one regular post.
- Assert the story card contains an element with class `aspect-[9/16]` and an `<img>` whose `src` matches `image_url`.
- Assert the regular post card has **no** `aspect-[9/16]` element (guarantees we didn't change normal cards).

## Out of scope

- AI Image (Sparkles) button in PostReviewPanel — unchanged.
- Large preview inside the open PostReviewPanel — already 9:16 for stories.
- Any other module, edge function, or table.

## Verification

- `bunx vitest run tests/regression/social/story-card-9x16-display.test.ts`
- Re-read the two edited files after the change.
- Visually confirm in the preview that the Tue/Wed story cards in the screenshot now show a 9:16 thumbnail.
