## Goal
Fix Instagram publishing reliably — both scheduled and manual — so a transient/per-account Meta error never blocks the whole card again, and the real failure cause is always visible.

## What we know from logs + DB

- Post `8f477be9…` (Jun 12, scheduled 14:00) — cron fired correctly at 14:00; all 6 IG accounts failed with Meta `code: 2 / is_transient: true / "An unexpected error has occurred"`. Retries at 14:25 returned identical code 2 for every account.
- Image URL is a clean public Supabase storage PNG, 1254×1254, 2.4 MB, sRGB, HTTP 200. Aspect ratio and size are within Instagram limits.
- 46 PNGs published successfully in the last 14 days, 5 failed — so PNG itself isn't the cause; something else triggers Meta's catch-all code 2.
- When code 2 hits one IG account on a given media, it consistently hits all sister accounts using the same URL — confirms it's media/URL-side, not account-side.
- Previous fix already deployed (last turn): exponential backoff + HEAD pre-flight + URL logging. But the failing retry happened *before* that deploy landed; no new diagnostic logs captured yet.

## Plan

### 1. Capture real signal (no code change)
Trigger one manual "Retry Publishing" on post `8f477be9…` after the previously deployed `social-publish` is live. The new logs will print `url=`, `content_type=`, `size=` and the HEAD pre-flight result, plus the raw Meta `error.code` / `fbtrace_id`. This confirms whether Meta is rejecting the URL itself or the file content.

### 2. Always serve IG-ready media through a JPEG proxy
Root-cause the "Meta sometimes can't fetch our Supabase URL" class of failure once and for all by routing every Instagram `image_url` through a small edge function:

- New function `supabase/functions/ig-media-proxy/index.ts` (public, `verify_jwt = false`):
  - Accepts `?src=<storage URL>&fmt=jpg`.
  - Streams the asset back with `Content-Type: image/jpeg`, `Cache-Control: public, max-age=86400, immutable`, no cookies, no CF bot-management headers.
  - For PNG sources, re-encodes to JPEG (quality 90, sRGB, strip metadata) using a tiny WASM JPEG encoder. Video sources pass through untouched.
- In `instagramPublish.ts`, before container creation, rewrite `imageUrl` to `${SITE_URL}/functions/v1/ig-media-proxy?src=<encoded>` for non-video media.
- Benefit: removes Cloudflare `__cf_bm` cookie noise, normalizes content-type, removes EXIF/ICC quirks, and gives Meta a clean cacheable JPEG URL — the configuration most consistently accepted by the IG Graph API.

### 3. Per-page partial publish (no more "one fails, all 6 marked failed")
- Today `social-publish` aggregates errors into one `last_error` string and marks the post `failed` if any page failed. Update so:
  - `page_results[]` already carries `status: published | failed` per page (verified in DB). Keep it.
  - Compute card status: `published` if ≥1 success, `partial_failed` if mixed, `failed` only if all failed.
  - `last_error` includes `fbtrace_id` for each failed page (e.g. `Ontario Steel Detailing — code 2, fbtrace AqapgdN2…`).
- "Retry Publishing" must only re-attempt pages whose `page_results[*].status === "failed"`. Pages already `published` get skipped (prevents duplicate posts). Frontend gate already shows page-level state; backend just needs to honor it.

### 4. Surface the truth in the toast
- Update `usePublishPost` toast to show the per-page summary returned by the function (e.g. "4 published, 2 failed — see card for details") instead of dumping the entire concatenated error string.
- Keep the existing "fbtrace_id + Meta could not fetch/process" wording from last turn's deploy for code 2 cases.

### 5. Light proactive token check (cheap, prevents the cascade)
Add a once-a-day `ig-token-health` cron that calls `/debug_token` for each linked IG/page token and flags any with `is_valid=false` or expiring in <7 days into a small banner on the Social Media page. Does not auto-reconnect; just surfaces so reconnect happens before the next cron run fails.

### 6. Regression test
Add `tests/regression/social/ig-media-proxy-jpeg.test.ts`:
- Asserts `instagramPublish.ts` wraps non-video image URLs through `ig-media-proxy`.
- Asserts `social-publish` returns `status: "partial_failed"` (not `failed`) when at least one page in `page_results` is `published`.
- Asserts retry path skips pages with `page_results[*].status === "published"`.

## Out of scope
- No DB schema changes beyond using existing `status` + `page_results` columns.
- No changes to the Neel approval gate or scheduling logic.
- No changes to LinkedIn / Facebook / TikTok publish paths.

## Files to be touched

- `supabase/functions/ig-media-proxy/index.ts` (new)
- `supabase/functions/_shared/instagramPublish.ts` (URL rewrite + fbtrace surfacing)
- `supabase/functions/social-publish/index.ts` (per-page status aggregation + retry-only-failed)
- `supabase/functions/ig-token-health/index.ts` (new, cron)
- `supabase/config.toml` (register the two new functions + cron)
- `src/hooks/usePublishPost.ts` (toast summary)
- `src/components/social/PostReviewPanel.tsx` and/or `ApprovalsPanel.tsx` (show per-page chip + banner) — only the read/display path
- `tests/regression/social/ig-media-proxy-jpeg.test.ts` (new)

## Risks & mitigations
- **Edge function cold-start adding latency** → proxy is lightweight (stream, no AI); cached aggressively via `Cache-Control`.
- **Re-encoding could alter image quality** → quality 90 + sRGB matches Meta's own ingestion pipeline; visually lossless for social.
- **Partial-publish status could confuse existing UI badges** → reuse existing `failed`/`published` chips with an added "Partial" variant; no breaking renames.
- **Proxy must remain public read** → no auth header; rate-limit by `src` host allowlist (Supabase storage only) to avoid abuse.
