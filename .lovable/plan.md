

## SEO Link Audit: Fix "0 Fixes" + Improvements

### Root Cause
The "Preview Fix" and "AI Fix Opportunities" buttons return 0 fixes because:

1. **Homepage resolution fails**: Most opportunities are on page_url `/` (homepage). `findWPItem` extracts an empty slug and tries "home", "homepage", "front-page" — but if the WordPress site uses a different slug or a static front page, none match. All 53 proposals return `{ error: "Could not find WordPress page/post" }`.

2. **No batch limiting**: All 53 audit IDs are sent to preview at once, each making an AI call sequentially. This risks edge function timeout (120s).

3. **Error proposals invisible**: The dialog renders error proposals but the "Apply N Fixes" button shows 0 and the errors are easy to miss.

### Plan

**File: `supabase/functions/seo-link-audit/index.ts`**

1. **Fix `findWPItem` for homepage**: After trying slug-based lookups, fetch the WordPress front page ID from the site settings endpoint (`/wp/v2/settings` or parse the homepage from the site URL). Also try fetching page ID=2 (common WP default for sample page) and page with `?orderby=menu_order&order=asc` as fallback.

2. **Store WP item ID during crawl**: When crawling, save the WordPress `item.id` and `item.type` (page/post/product) as `wp_item_id` and `wp_item_type` on the `seo_link_audit` record. This eliminates the need for slug-based lookups during preview/fix — direct ID fetch instead.

3. **Limit preview batch**: Cap preview to 10 items per call. The frontend should show a message if more are available.

**File: `src/components/seo/SeoLinks.tsx`**

4. **Batch preview requests**: When clicking "AI Fix Opportunities (53)", only send the first 10 IDs. Show count of remaining.

5. **Show error feedback in dialog**: When all proposals are errors, display a clear message explaining what went wrong (e.g., "Could not resolve WordPress pages"). Show error count prominently.

6. **Add per-item "Preview Fix" progress**: Show which item is being processed (spinner on the row).

### Technical Details

```text
Crawl phase change:
  Before: record = { page_url, link_href, ... }
  After:  record = { page_url, link_href, wp_item_id: item.id, wp_item_type: "page"|"post", ... }

findWPItem change:
  Before: slug lookup only → fails for "/"
  After:  1) Check wp_item_id from record (direct fetch)
          2) Slug lookup
          3) Fallback: fetch front page via /wp/v2/pages?orderby=menu_order

Preview batch:
  Before: Send all 53 IDs → timeout + 53 AI calls
  After:  Send max 10 IDs → manageable
```

**Database migration needed**: Add `wp_item_id` (integer, nullable) and `wp_item_type` (text, nullable) columns to `seo_link_audit` table.

