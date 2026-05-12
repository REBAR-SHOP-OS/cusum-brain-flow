## Root cause

The Pages panel (LinkedIn / Facebook / Instagram / X) is shown **grouped per platform** because each platform has its own list of pages (e.g. LinkedIn has `Sattar Esmaeili-Oureh (Personal)` which does not exist on Facebook). Internally, however, the panel keeps **one flat array `localPages`** of all selected page values across all groups.

When you press **Save (N)** it calls `handlePagesSaveMulti` in `src/components/social/PostReviewPanel.tsx` (lines 698–713):

```ts
const pagesString = values.join(", ");
await supabase.from("social_posts").update({ page_name: pagesString }).eq("id", post.id);
```

Two bugs follow from this:

1. **Only the current row is updated.** When a card has been split across 4 platforms, there are 4 sibling rows (one per platform). The save writes the joined page string only to `post.id`. The other platform rows keep their old `page_name`, so deselecting a page on, say, LinkedIn does not remove it from the LinkedIn sibling row — the publisher still sees the old set and posts to it.
2. **Pages from other platforms leak into the row.** The flat string mixes pages from every group. Saving 2 LinkedIn pages while a Facebook group is also visible writes `"Rebar.shop Ontario, Rebar.shop, <facebook pages…>"` into whatever the current row happens to be. Backend `social-publish` splits `page_name` on `", "` and tries to post each page on that row's platform → it either silently posts to extra pages or fails for pages that do not exist on that platform.

Net effect the user sees: deselecting a page in the panel has no effect — the post still publishes to "all pages".

## Fix

Make `handlePagesSaveMulti` **per-platform** and **sibling-aware**, mirroring how `handleContentTypeSave` already works.

In `src/components/social/PostReviewPanel.tsx`:

1. Replace `handlePagesSaveMulti` with logic that:
   - Computes per-platform selection: for each platform in `localPlatforms`, take `values ∩ PLATFORM_PAGES[platform].map(o => o.value)`.
   - Validates that **every selected platform has at least one page**. If a platform ends up with zero pages, show a toast naming the platform and abort save (do not silently drop the row).
   - For each platform `p` in `localPlatforms`, run an `UPDATE social_posts SET page_name = <p's joined pages> WHERE platform = p AND title = post.title AND scheduled_date = post.scheduled_date` (same sibling key as `handleContentTypeSave`).
   - Run those updates in parallel via `Promise.all`; on any error toast and stop. On success invalidate `["social_posts"]` and close the sub-panel.
2. Update local state with the validated flat union (`setLocalPages(values)`) so the main panel summary stays in sync.
3. Leave `handleContentTypeSave` and `handlePlatformsSaveMulti` untouched — they already scope correctly.

No DB schema, RLS, edge-function, or hook changes. No changes to `SelectionSubPanel.tsx`. No change to publishing logic — `social-publish` will receive the correct per-platform `page_name` automatically.

## Files to change

- `src/components/social/PostReviewPanel.tsx` — `handlePagesSaveMulti` (lines 698–713).

## Validation

- Open a card already split across Facebook + Instagram + LinkedIn + X. Open Pages, deselect `Sattar Esmaeili-Oureh (Personal)` under LinkedIn, keep all Facebook/Instagram/X pages, press Save.
  Expected: only the LinkedIn row's `page_name` loses Sattar; Facebook/Instagram/X rows are unchanged. Publishing posts to exactly the remaining pages.
- Deselect every page under one platform group and press Save.
  Expected: toast "Select at least one page for <Platform>" and no DB write.
- Single-platform card: behavior unchanged — the one platform's row is updated to the selected pages.
