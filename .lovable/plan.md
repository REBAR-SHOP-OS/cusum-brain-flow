## Problem

When the user clicks "Auto-generate today" for stories, `auto-generate-post` returns Success in ~4s and runs all 5 image generations in `EdgeRuntime.waitUntil(...)` background work in the **same isolate**. Edge function logs (this session) show the isolate getting `shutdown` events while the background batch is still finishing — the final story slots resize successfully but the subsequent `social_posts.update(image_url=...)` writes never land, so the 5 placeholder cards stay "Unassigned / Draft" with no image. This is the exact failure visible in the user's screenshot for Thu 4.

Root cause: `EdgeRuntime.waitUntil` is best-effort — Supabase can evict the isolate before background DB updates flush, and a single 5-image story run consistently brushes that limit (3 batches × ~25–35s gpt-image-2 + crop + upload + update).

## Fix (surgical, story-path only)

Move story image generation out of the long-lived background batch and into N short-lived, independent edge-function invocations — one per placeholder — driven by the client. Each call uses the already-stable `regenerate-post` story path (`story_mode: true, image_only: true`), which:
- has its own fresh isolate (no eviction risk from siblings),
- already writes `image_url` to the post row on success,
- already uses `openai/gpt-image-2 @ 1024x1792 → strict 9:16 → 1080×1920`.

### Changes

1. **`src/hooks/useAutoGenerate.ts`** — when `mode === "story"` and `aspectRatio === "9:16"`:
   - Keep the existing placeholder insert (5 rows with `content_type: "story"`).
   - Instead of calling `auto-generate-post`, fan out 5 parallel `supabase.functions.invoke("regenerate-post", { body: { post_id, image_only: true, story_mode: true, product, /* per-slot variation hint */ } })` calls.
   - Use `Promise.allSettled` so one failed slot doesn't drop the others; after each settle, invalidate `["social_posts"]` so cards fill in progressively.
   - On any slot returning no image / error, delete that placeholder row (matches current behavior).
   - Non-story modes (regular posts, other aspect ratios) keep calling `auto-generate-post` unchanged.

2. **`supabase/functions/regenerate-post/index.ts`** — accept an optional `product` and `variation_hint` (angle/lighting/palette/headline seed) in the body so each parallel call produces a visually distinct 9:16 ad, matching the variety the old batch produced. If absent, fall back to current behavior. No change to the gpt-image-2 path, crop, or `assertStoryDimensions`.

3. **`supabase/functions/auto-generate-post/index.ts`** — leave the story branch in place as a fallback (no removal, no behavior change), but it will no longer be the primary path for `mode: "story" + 9:16`. Non-story flows are untouched.

4. **`tests/regression/social/story-images-strict-9x16.test.ts`** (extend) and **`tests/regression/social/regenerate-story-9x16.test.ts`** (extend):
   - Assert `useAutoGenerate` story branch dispatches one `regenerate-post` per placeholder with `story_mode: true, image_only: true`.
   - Assert it does NOT call `auto-generate-post` for `mode: "story" + 9:16`.
   - Assert `regenerate-post` still locks 9:16 + 1080×1920 and now accepts `product` / `variation_hint` without regressing the existing story path.

## Out of scope (will not touch)

- Neel-only approval gate, publish flow, caption regeneration, video flows.
- The non-story branch of `auto-generate-post` (calendar posts, 1:1 / 4:5 / 16:9 generations).
- The "Regenerate Story" button (already stable on `regenerate-post`).
- Any DB migration, RLS, or auth change.

## Why this is safe

- Adds a per-image execution boundary — eviction of one isolate can only lose one image, not the whole batch, and the placeholder for that slot is cleaned up exactly like today.
- Reuses the already-passing `regenerate-post` story path verified by the existing 9:16 regression tests.
- Old `auto-generate-post` story background code stays as fallback; rollback = revert the client hook.
