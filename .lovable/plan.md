## Problem

When publishing an **image Story** (the card in your screenshot — a Canada World Cup PNG, no video), the toast still shows:

> "Preparing video for Instagram… Re-encoding to Reels-safe spec (30 fps, H.264 level 4.1)."

This is wrong and misleading. It also triggers `normalizeForInstagram(url)` on a PNG, which either silently fails or wastes time and bandwidth, and can corrupt the post by overwriting `image_url` with a re-encoded blob.

## Root Cause

`src/hooks/usePublishPost.ts` line 86–89:

```ts
const looksLikeVideo =
  /\.(mp4|m4v|mov|webm|mkv)(\?|$)/i.test(url) ||
  post.content_type === "story" ||
  post.content_type === "reel";
```

`content_type === "story"` is **not** proof of video. Stories on this app are predominantly image stories (per `Stories are image/video only — no caption needed` note in the side panel). The OR-branch on `content_type` forces the video pipeline on every story regardless of media kind.

## Fix (surgical, safe, additive)

1. **`src/hooks/usePublishPost.ts`** — Replace the `looksLikeVideo` heuristic with a media-kind detector that requires actual video signal:
   - Treat as video only if **URL extension** is `mp4|m4v|mov|webm|mkv` **OR** the HEAD `content-type` starts with `video/`.
   - `content_type === "reel"` stays as a video hint (reels are always video) — but only used as a fallback after the URL/HEAD check is inconclusive.
   - `content_type === "story"` is removed from the video gate entirely. A story is a video only when its URL/HEAD says so.
   - The HEAD probe a few lines above already runs; reuse its result instead of probing twice.

2. **Toast only fires after we've actually decided to re-encode**, not before. Move the toast inside the `if (looksLikeVideo)` branch *after* `normalizeForInstagram` confirms it received a video (i.e., gate by `norm.reencoded` or by file MIME). This eliminates the false "Preparing video…" message on image stories.

3. **Guard `uploadSocialMediaAsset(..., "video")` overwrite** — only swap `image_url` when `norm.reencoded === true` AND the resulting blob's MIME starts with `video/`. Prevents an image story from being overwritten with a video blob URL on edge cases.

4. **Regression test** — add `tests/regression/social/image-story-skips-video-pipeline.test.ts`:
   - Asserts: given a `content_type: "story"` post with `image_url` ending in `.png`, the publish flow does not call `normalizeForInstagram` and does not emit the "Preparing video for Instagram…" toast.
   - Asserts: given a `.mp4` URL with `content_type: "story"`, the video pipeline still runs (no regression for video stories).

## Files Touched

- `src/hooks/usePublishPost.ts` — tighten `looksLikeVideo`, move toast inside re-encode branch, gate `image_url` overwrite on video MIME.
- `tests/regression/social/image-story-skips-video-pipeline.test.ts` *(new)* — locks the rule.

## Out of Scope (intentionally not touched)

- `normalizeForInstagram`, `uploadSocialMediaAsset`, `instagramPublish.ts`, edge functions — they're fine; the bug is purely in the client-side gate.
- Story validation / story 9:16 enforcement — unchanged.
- Neel approval gate, IG media proxy, retry/partial-publish logic — unchanged.

## Verification

1. Re-read edited `usePublishPost.ts` after change.
2. Run `bunx vitest run tests/regression/social/image-story-skips-video-pipeline.test.ts` — must pass.
3. Manual check in preview: retry-publish the Canada World Cup story — toast must say nothing about video; publish goes straight to the IG `/media` (image) container.
