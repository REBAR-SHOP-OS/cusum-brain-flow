## Root cause

In `src/components/social/PostReviewPanel.tsx`, three update queries don't scope by the card's own `post.id`. Instead they match by `platform + title + scheduled_date` (or `title` + day window). Whenever any other card happens to share the same title, platform and date (very common — empty "Post title", auto-generated batches, repeated titles), those cards also get overwritten.

Bug sites:

1. **Pages save** (`handlePagesSaveMulti`, lines 740–750) — `.eq("platform").eq("title", post.title).eq("scheduled_date", post.scheduled_date)` overwrites every sibling card with the same title/platform/time. This is exactly the case shown in the screenshot.
2. **Content type save** (lines 700–706) — same broad match.
3. **Set date** (lines 1357–1368) — matches by `platform + title` within the day window.

## Fix

Scope every per-card edit strictly to `post.id`:

- `handlePagesSaveMulti` → update only `post.id` (the single card the user clicked). Drop the "loop across platforms" sibling write entirely; per the user's rule, a card edit must never touch other cards.
- Content type save → `.eq("id", post.id)` only.
- Set date `onSetDate` → `.eq("id", post.id)` only; remove the title/day-window fallback and update the toast text from "All copies moved…" to "Card moved…".

No other behavior changes; multi-platform creation flow (which intentionally writes sibling rows on the initial Save) is untouched.

## Files

- `src/components/social/PostReviewPanel.tsx` — narrow the three update queries above.
- `tests/regression/social/card-edit-scope-to-id.test.ts` — new regression test asserting the Pages / content-type / set-date updates filter by `id` only and never by `title`/`scheduled_date`.

## Verification

- Re-read the patched file to confirm only `.eq("id", post.id)` remains on those three paths.
- Run `bunx vitest run tests/regression/social/card-edit-scope-to-id.test.ts`.
- Manual check in preview: change Pages on one card with a duplicate-title sibling on the same day → only the clicked card updates.