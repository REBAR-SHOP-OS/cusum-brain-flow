## Root cause

When you create a new card via **Add Card**, it is inserted with `platform: "unassigned"`, empty `title`, empty `content`. You then upload media, type a caption, open the **Platforms** panel and tick 4 platforms (Facebook / Instagram / LinkedIn / X) and press **Save (4)**.

That save runs `handlePlatformsSaveMulti` in `src/components/social/PostReviewPanel.tsx` (lines 535–606). The logic is:

1. Find "siblings" with `p.title === post.title && p.scheduled_date === post.scheduled_date`.  
   Because the new card has `title = ""`, this matches **every other empty-title draft on the same day**, not just this card.
2. Mark every sibling whose platform is not in the new selection (i.e. every `unassigned` row, including the current one) for **DELETE**.
3. **INSERT** one fresh row per selected platform, copying `image_url`, `content`, `hashtags`, `page_name`, etc. from `post`.

Two things go wrong:

- The current card row (and possibly other unrelated empty-title drafts on the same day) is **deleted**, so the panel's `post` becomes a dangling id. `onSelectNewPost` is only called when a freshly-inserted row is found in the Promise results, and only re-points the side panel — the calendar then shows whichever new rows survived (which may not be visible to you because selection moved or the current view filter hides them).
- Any caption / image still in local React state that hasn't been flushed to the DB is lost, because the new rows are built from the **stale** `post` snapshot.

Result: the card you were editing visually "disappears" — it was destroyed and replaced by new platform-specific rows that you weren't looking at, and any unsaved caption text is gone.

## Fix

Change `handlePlatformsSaveMulti` so it does **not** delete the current row when the post is in the `unassigned` (or otherwise being-assigned) state. Strategy:

1. **Tighten sibling matching.** Require a non-empty `post.title` before doing any sibling delete. If the title is empty, treat only the current `post.id` as the sibling set (so unrelated empty drafts on the same day are never touched).
2. **Convert-in-place instead of delete+insert** when the current card's platform is `unassigned`:
   - `UPDATE` the current row's `platform` to the **first** selected DB platform and set its `page_name` to the joined pages string.
   - `INSERT` one new row per **additional** selected platform, copying the (now-fresh) field values — including the freshly-uploaded `image_url` and the freshly-typed `content` — from the current row (re-fetched or from local state).
   - Do not delete anything.
3. **Flush pending caption / title edits first.** Before assigning platforms, persist any local caption / title edits to the current row (await an `updatePost` for `id, title, content, hashtags`) so the new platform rows are cloned from up-to-date data, not the stale snapshot.
4. **Selection stability.** After the in-place update, keep the side panel pointed at the same row id (now bearing the first selected platform). No `onSelectNewPost` jump needed in the unassigned-conversion path.
5. For the existing already-assigned case (post.platform is a real platform and user toggles platforms), keep the current delete-old / add-new behaviour but with the tightened sibling filter (id-based when title is empty).

## Files to change

- `src/components/social/PostReviewPanel.tsx`
  - `handlePlatformsSaveMulti` (≈ lines 535–606): add the unassigned-conversion branch, tighten sibling filter, await caption/title flush before mutating.

No DB schema, RLS, or hook changes required.

## Validation

- Add Card → upload image → type caption → open Platforms → pick 4 platforms → Save.  
  Expected: card stays visible, image and caption preserved, card is now split into 4 platform-specific rows on the same day, side panel stays open on the first one.
- Repeat with only 1 platform selected.  
  Expected: the original row is updated in place to that platform; no new rows; no deletions.
- Repeat with an already-assigned card, toggling platforms on/off.  
  Expected: existing per-platform behaviour unchanged; sibling deletes still scoped to this card's title+time, never to other empty drafts.
