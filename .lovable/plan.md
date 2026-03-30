

# One Card Per Time Slot + Platform (Pages as Metadata)

## Problem
Currently, selecting multiple pages creates separate DB rows (one per page), resulting in multiple cards in the calendar for the same time+platform. The user's rule: **1 time slot + 1 platform = 1 card**. Pages should be stored as metadata on that single card.

## Solution

### File: `src/components/social/PostReviewPanel.tsx`

1. **Rewrite `handlePagesSaveMulti`**: Instead of creating/deleting sibling rows per page, simply **update the current post's `page_name`** field with all selected pages joined as comma-separated string (e.g. `"Ontario Steel Detailing, Rebar.shop"`). No row creation or deletion.

2. **Rewrite `handlePlatformsSaveMulti`**: When adding a new platform, create ONE row per platform (not one per page). Set `page_name` to the comma-separated list of all currently selected pages. When removing a platform, delete its single row.

### File: `src/components/social/SocialCalendar.tsx`

3. **Display pages on card**: Show the `page_name` value (which may contain multiple comma-separated names) on the card — already handled since it displays `post.page_name`.

### No DB migration needed
`page_name` is already a `text` column — storing comma-separated values works without schema changes.

## Result
- Selecting Instagram + 3 pages → 1 card showing "Instagram" with pages as metadata
- Selecting 2 platforms + 3 pages → 2 cards (one per platform), each with all 3 pages stored
- Calendar stays clean: 1 card per time slot per platform

## Files Changed
- `src/components/social/PostReviewPanel.tsx` — simplify page/platform save handlers

