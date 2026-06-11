## Goal

When the user clicks the story-reel icon to auto-generate 5 stories:
1. The 5 cards must reliably refresh with their generated images (no stuck "?" placeholders).
2. The unrelated "Something went wrong — Failed to update a ServiceWorker" toast must stop appearing.

## Root cause

**Cards stuck on "?"**
- `src/hooks/useAutoGenerate.ts` schedules cache invalidation only at **5s / 15s / 30s** after the edge call returns.
- Story background generation runs in `auto-generate-post` and routinely takes **60–120s** (5 images, batched 2 at a time, ~15–25s each through `openai/gpt-image-2`).
- The realtime channel in `useSocialPosts` *should* push updates, but if the tab is backgrounded, the channel reconnects, or the user filters/scrolls, the placeholders can persist until a manual reload.
- DB confirms images are being written correctly (verified Sat 13 placeholders — all 5 have valid `image_url`s). This is purely a client-refresh gap.

**ServiceWorker toast**
- Preview environment (`id-preview--*.lovable.app`) sometimes returns `/sw.js` behind a redirect, which the browser refuses to use.
- The rejection bubbles to `GlobalErrorHandler` and shows a red "Something went wrong" toast. It has no impact on app functionality.

## Changes

### 1. `src/hooks/useAutoGenerate.ts` — extend story polling window
When `options.mode === "story"`, replace the current short polling schedule with one that covers the realistic image-gen window:
- Poll at 5s, 15s, 30s, 45s, 60s, 80s, 100s, 120s, 150s.
- Stop polling early (clear remaining timers) once all `placeholderIds` have a non-null `image_url` in the cache, so we don't keep hitting the DB unnecessarily.
- Keep the existing short schedule for non-story mode (caption generation is fast).

This is purely additive — no change to edge function, no change to DB, no change to realtime.

### 2. Suppress benign ServiceWorker registration errors

Find the global handler (likely in `src/main.tsx` or a `GlobalErrorHandler` component — confirm during build). Filter out unhandled rejections whose message matches:
- `Failed to update a ServiceWorker`
- `script resource is behind a redirect`

Log them to console at `info` level instead of firing a toast. Keep all other unhandled rejections surfacing as before.

This is a narrow string match on a known preview-environment artifact, not a blanket suppression.

## Out of scope

- No changes to `auto-generate-post` edge function (it works).
- No changes to story image prompt, aspect cropping, or storage.
- No changes to `schedulePost` or the declined-post gate.
- No retry / cancel UI for the placeholders (separate request).

## Verification

1. Click the story-reel icon → pick date/aspect/product → 5 "?" cards appear immediately.
2. Within ~120s, all 5 cards refresh with images without manual reload.
3. ServiceWorker redirect events no longer raise a toast in preview; check console for the muted info log.
4. Normal unhandled rejections (forced via a thrown error) still surface a toast.
5. Non-story auto-generate flow is unchanged (still polls at 5/15/30s).

## Files touched

- `src/hooks/useAutoGenerate.ts`
- One of: `src/main.tsx` or the `GlobalErrorHandler` component (confirmed at build time).
