

# Fix: Pages Not Reflecting After Save

## Root Cause

When pages are stored as comma-separated strings in `page_name` (e.g. `"Ontario Steel Detailing, Rebar.shop, Ontario Logistics"`), two places treat this whole string as a single value instead of splitting it:

1. **`SocialMediaManager.tsx` line 81**: `groupPages` collects `s.page_name` without splitting → results in `["Ontario Steel Detailing, Rebar.shop, ..."]` (1 element) instead of individual page names
2. **`SocialCalendar.tsx` line 166**: `onGroupClick(post, [post.page_name])` wraps the whole comma string as one array element

Both feed into `PostReviewPanel` where `localPages` is set from `groupPages`, causing `Pages (1)` to display even when 6 pages were selected.

## Fix

### File: `src/pages/SocialMediaManager.tsx`
**Line 81** — Split comma-separated `page_name` before deduplication:
```typescript
return [...new Set(
  siblings.flatMap(s => s.page_name ? s.page_name.split(", ").filter(Boolean) : [])
)] as string[];
```

### File: `src/components/social/SocialCalendar.tsx`
**Line 166** — Split `page_name` when passing to `onGroupClick`:
```typescript
onGroupClick(post, post.page_name ? post.page_name.split(", ").filter(Boolean) : []);
```

## Result
- Saving 6 pages → `Pages (6)` displays correctly in the review panel
- Calendar cards show full page list
- Scheduling reflects the correct pages

## Files Changed
- `src/pages/SocialMediaManager.tsx` — fix `groupPages` derivation
- `src/components/social/SocialCalendar.tsx` — fix `onGroupClick` page splitting

