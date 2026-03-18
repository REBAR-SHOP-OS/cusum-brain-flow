

## Fix: AI Fix Preview Returns 0 Fixes + Infinite check_broken Loop

### Root Cause Analysis

Two bugs found:

**Bug 1 - Infinite `check_broken` loop:** In the frontend (`SeoLinks.tsx` lines 87-96), the crawl runs `check_broken` in a while-loop until `remaining === 0`. But the edge function only marks links as "broken" — links returning HTTP 200 stay with `status: "ok"` and get re-fetched every iteration. The `remaining` count never decreases (always 36-40), creating an infinite loop.

**Bug 2 - Preview returns empty proposals:** The `handlePreview` function calls `findWPItem(wp, record.page_url)` for each audit record. Looking at the data, many pages have `page_url = "/"` (homepage). `findWPItem` extracts the slug from the pathname, and for "/" the slug is empty string, causing it to return `null`. All proposals end up with `{ error: "Could not find WordPress page/post" }`. The "Apply N Fixes" button only counts proposals where `!p.error && p.before_paragraph`, resulting in "Apply 0 Fixes". The error proposals also aren't clearly visible because the dialog body appears empty when all proposals are errors.

### Plan

**File 1: `supabase/functions/seo-link-audit/index.ts`**

1. **Fix check_broken infinite loop:** After checking an external link that returns HTTP 200 (not broken), update its status from `"ok"` to `"checked"` so it won't be re-fetched.
2. **Fix findWPItem for root URL:** When slug is empty (homepage), try fetching the front page from WP API using `?slug=home` or by fetching site info. Add fallback logic to search by page URL.
3. **Add console logging to preview phase** so issues are visible in edge function logs.
4. **Limit preview batch size** to max 10 items at a time to avoid timeout.

**File 2: `src/components/seo/SeoLinks.tsx`**

5. **Show error proposals in dialog:** When proposals have errors, display them with a clear error message so the user knows what went wrong (not just an empty dialog).
6. **Update filter for "checked" status:** Include `"checked"` status links in the "all" tab display but not in the "broken" filter.
7. **Add safety limit to check_broken loop:** Add a max-iterations guard (e.g., 50) to prevent infinite loops even if the backend has issues.

### Technical Details

```text
check_broken fix (edge function):
  Before: Links with HTTP 200 stay as status="ok" → re-fetched forever
  After:  Links with HTTP 200 updated to status="checked" → excluded from next batch

findWPItem fix (edge function):
  Before: slug="" for "/" → returns null
  After:  For empty slug, try fetching homepage via front-page endpoint or search

Frontend loop guard:
  Before: while (remaining > 0) { ... }
  After:  while (remaining > 0 && iterations < 50) { ... }
```

