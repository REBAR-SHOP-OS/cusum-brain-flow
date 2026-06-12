## Problem

The Instagram card from your screenshot (post `092234f7-…`, scheduled 10:00 AM) is stuck showing **"Publishing 🔄"** in the calendar, but the database tells the real story:

- `status = "publishing"` (still locked from 15:03 UTC)
- `last_error` already contains all 6 IG per-page rejections (Meta code 2 on every page)
- `page_results` was reset to all-pending on retry
- `publishing_started_at` is fresh enough that the 10-min stale-lock recovery hasn't kicked in yet

So **the truth is "failed on every page"**, but the UI keeps showing the optimistic "Publishing" label until the cron-side stale-lock recovery (10 min for images, 20 min for IG video) eventually flips it. That delay is the display bug you're seeing.

## Root Cause (two layers)

1. **Frontend trusts `status` blindly.** `SocialCalendar.tsx` (line 287 → `STATUS_LABELS[status]`) and card color block (line 310 onward) render whatever `social_posts.status` says, without consulting `page_results` or `last_error`. So a stuck-publishing post displays as in-progress even when every page already failed.

2. **Backend finalizer doesn't always release the lock.** `social-publish/index.ts` has multiple early-return paths (token failure, no pages, platform-not-supported) and the per-page loop can also exit before `releasePublishLock` runs if any awaited helper throws. The cron `recoverStaleLocks` is the only safety net and it waits 10 min (images) or 20 min (IG video), leaving the UI lying for that whole window.

## Fix (surgical, safe, additive)

### A — Frontend: derive the displayed status from real signal (primary fix)

New helper `src/lib/socialPostStatus.ts` exporting `resolveDisplayStatus(post)`:

- Start with `post.status`.
- If `status === "publishing"`:
  - Read `page_results` (Json array of `{ name, status: pending|success|failed }`).
  - If `page_results.length > 0` and **every** entry is `"failed"` → return `"failed"`.
  - If `page_results.length > 0` and **every** entry is `"success"` → return `"published"`.
  - If `page_results.length > 0` and **mixed** (some success, some failed/pending) and `now − updated_at > 60 s` → return `"published"` (partial), with a `partial: true` flag.
  - If `now − updated_at > 180 s` (images, no video extension on `image_url`) → return `"failed"` (stale; UI shouldn't lie longer than 3 min for image posts).
  - Otherwise → stay `"publishing"`.
- Returns `{ displayStatus, partial, isStale }`.

Hook the helper into:

- **`src/components/social/SocialCalendar.tsx`** — replace direct `post.status` reads in `STATUS_LABELS[status]` and the card color cascade (`status === "publishing"` → blue) with `resolveDisplayStatus(post).displayStatus`. `partial` adds a small amber dot/tooltip; `isStale` forces the red `failed` styling.
- **`src/components/social/PostReviewPanel.tsx`** — same resolver for the right-side "Publishing…" / "Approved by Neel" badge so the side panel matches the calendar.

This alone fixes the user's complaint: the card will go red within 3 minutes of every page failing, instead of waiting 10 min for the cron.

### B — Backend: guarantee finalization (root-cause hardening)

`supabase/functions/social-publish/index.ts`:

- Wrap the request handler body in a `try { … } finally { … }` block. The `finally` checks: if `post_id && lockId` and the post is still in `status="publishing"` with that `lockId`, read `page_results` and call `releasePublishLock(…, finalStatus)` where `finalStatus` is computed exactly like the cron recovery (all success → `published`, some success → `published` + partial last_error, none success / all pending → `failed`).
- This is **idempotent** with the existing `await releasePublishLock(…, "published"|"failed")` calls — if release already happened, the `.eq("publishing_lock_id", lockId)` in `releasePublishLock` no-ops on the second call. Cost: zero. Benefit: no more orphaned `publishing` rows when an early-return path is hit.

### C — Shorter image stale-lock window

`supabase/functions/_shared/publishLock.ts → recoverStaleLocks`:

- Drop the image cutoff from **10 min → 3 min** (matches the frontend's "stale → failed" threshold so cron and UI agree). Video / IG-reels cutoff stays at **20 min** (unchanged).
- This is the only behavioral cron change.

### D — One-shot cleanup of the existing stuck row

After deploy, run a single targeted SQL via `supabase--read_query` to confirm `092234f7-…` and the two older `publishing` rows now flip — or finalize them with a migration that calls `recoverStaleLocks` semantics manually. (Will be performed in build mode, not as a permanent migration.)

### E — Regression test

`tests/regression/social/publishing-display-status.test.ts` (new):

- `resolveDisplayStatus({ status: "publishing", page_results: [all failed], updated_at: 30s ago })` → `"failed"`.
- `resolveDisplayStatus({ status: "publishing", page_results: [all success], updated_at: 30s ago })` → `"published"`.
- `resolveDisplayStatus({ status: "publishing", page_results: [mixed], updated_at: 90s ago })` → `"published"` with `partial: true`.
- `resolveDisplayStatus({ status: "publishing", page_results: [all pending], updated_at: 4 min ago, image_url: 'x.png' })` → `"failed"` (image stale).
- `resolveDisplayStatus({ status: "publishing", page_results: [], updated_at: 30s ago })` → `"publishing"` (still legitimate in-flight).
- `resolveDisplayStatus({ status: "published" })` → `"published"` (no transformation when status is already final).

## Files Touched

- `src/lib/socialPostStatus.ts` *(new)* — pure resolver.
- `src/components/social/SocialCalendar.tsx` — swap `post.status` reads for resolver.
- `src/components/social/PostReviewPanel.tsx` — same swap on the side panel badge.
- `supabase/functions/social-publish/index.ts` — wrap body in try/finally finalizer.
- `supabase/functions/_shared/publishLock.ts` — image stale cutoff 10 → 3 min.
- `tests/regression/social/publishing-display-status.test.ts` *(new)*.

## Out of Scope (intentionally untouched)

- Meta code 2 retry strategy, IG media proxy, video normalization — unchanged.
- Neel approval gate, RLS, schema — unchanged.
- The bigger root cause of *why* Meta is rejecting these PNGs — that's the prior fix (proxy + JPEG re-encode) and is independent.

## Verification

1. Re-read every edited file after the change.
2. `bunx vitest run tests/regression/social/publishing-display-status.test.ts` — must pass.
3. Deploy `social-publish` edge function.
4. Query DB: `092234f7-…` should be `failed` (red card) within minutes; preview should match.
5. Manually retry one post — card flips to publishing, then to published or failed within ~3 min, never indefinitely.
