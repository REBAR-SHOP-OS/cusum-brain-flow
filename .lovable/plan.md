

# Fix: One Card Per Platform (Pages as Metadata, Not Separate Rows)

## Problem

When scheduling a post with 2 platforms × 6 pages, the system creates **12 separate DB rows** (one per platform×page combo). The rule is: **1 platform + 1 time slot = 1 card**, with all pages stored as comma-separated `page_name`.

## Root Cause

Two places build a cartesian product of `platform × page`:

1. **`PostReviewPanel.tsx` lines 1238-1244**: The schedule button builds `combos[]` by iterating `for (platform) { for (page) { push } }` — creating one combo per page per platform
2. **Edge function `schedule-post/index.ts`**: Receives these combos and creates one DB row per combo (lines 55-106 for unassigned, lines 167-220 for normal)

## Solution

### 1. `src/components/social/PostReviewPanel.tsx` — Build combos per platform, not per page

Replace the platform×page cartesian product (lines 1238-1244) with one combo per platform, where `page` is the comma-separated string of all selected pages:

```typescript
const pagesString = localPages.join(", ");
const combos: { platform: string; page: string }[] = [];
for (const plat of schedulablePlatforms) {
  const dbPlat = platformMap[plat] || plat;
  combos.push({ platform: dbPlat, page: pagesString });
}
```

### 2. `supabase/functions/schedule-post/index.ts` — Match by platform only (not page_name)

The duplicate check (line 61) currently matches `eq("page_name", combo.page)`. Since `page_name` is now a comma-separated string, change duplicate detection to match by `platform + title + day` only (not page_name). Update both the unassigned path (line 55-106) and the normal path (line 167-220):

- Remove `.eq("page_name", combo.page)` from duplicate checks
- When inserting/updating, set `page_name: combo.page` (the comma-separated string)

### 3. Also fix `SocialMediaManager.tsx` line 234 and `SchedulePopover.tsx` line 74-76

These also pass `extra_combos` with individual pages — update to use comma-separated page string instead.

## Result
- 2 platforms × 6 pages → **2 cards** (one per platform), each showing all 6 pages as metadata
- Calendar stays clean: 1 card per time slot per platform

## Files Changed
- `src/components/social/PostReviewPanel.tsx` — combos per platform, not per page
- `supabase/functions/schedule-post/index.ts` — duplicate check by platform+title+day only
- `src/pages/SocialMediaManager.tsx` — fix extra_combos format
- `src/components/social/SchedulePopover.tsx` — fix extra_combos format

