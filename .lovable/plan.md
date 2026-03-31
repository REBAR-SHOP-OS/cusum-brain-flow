

# Fix LinkedIn Showing Wrong Page Count

## Problem
LinkedIn cards display "Pages (5)" but LinkedIn only has 2 pages (Ontario Steel Detailing, Ontario Logistics). The extra 3 pages (Rebar.shop, Ontario Digital Marketing, Ontario Steels, Rebar.shop Ontario) belong to Facebook/Instagram only.

## Root Cause
Two places allow invalid pages to persist:

1. **`SocialMediaManager.tsx` line 81**: `groupPages` collects page names from siblings without filtering against valid pages for the platform. If the DB `page_name` field contains Facebook pages on a LinkedIn record, they pass through.

2. **`PostReviewPanel.tsx` line 211-214**: When `groupPages` or `post.page_name` is loaded, the pages are set directly without filtering against `PLATFORM_PAGES[platform]`.

## Changes

### 1. `src/components/social/PostReviewPanel.tsx` (lines 207-215)
After setting `localPlatforms`, filter `localPages` to only include pages that exist in `PLATFORM_PAGES` for the current platform:

```typescript
// After computing pages from groupPages or post.page_name:
const validPagesForPlatform = new Set(
  [post.platform].flatMap(p => (PLATFORM_PAGES[p] || []).map(o => o.value))
);
const filtered = rawPages.filter(p => validPagesForPlatform.has(p));
setLocalPages(filtered.length > 0 ? filtered : rawPages);
```

### 2. `src/components/social/PostReviewPanel.tsx` — `handlePagesSaveMulti` (line 484)
Already saves to DB correctly. No change needed — but the filtering above ensures only valid pages are shown and selectable.

### 3. `src/pages/SocialMediaManager.tsx` (lines 73-82)
Filter `groupPages` against `PLATFORM_PAGES` for the selected platform before returning:

```typescript
import { PLATFORM_PAGES } from "@/lib/socialConstants";
// ...
const validSet = new Set((PLATFORM_PAGES[selectedPost.platform] || []).map(o => o.value));
return allPages.filter(p => validSet.has(p));
```

## Impact
- LinkedIn cards will correctly show "Pages (2)" with only Ontario Steel Detailing and Ontario Logistics
- Existing DB data with incorrect pages won't cause display issues — filtered at render time
- No DB migration or edge function changes needed

