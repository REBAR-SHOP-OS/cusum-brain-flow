

# Fix: Stop Cloning Posts on Publish — Keep Single Card

## Problem

When "Publish Now" is clicked, the frontend splits a post with Pages(5) across 3 platforms into up to 15 separate combos. It uses the original row for the first combo and **creates clone rows** (via `createPost.mutateAsync`) for combos 2–15. These clones:

1. Appear as separate "Pages (1) · Draft" cards in the calendar (visible in screenshot, circled in red on Sunday)
2. Often fail to publish (duplicate guard or race condition), leaving orphan Draft cards
3. Break the visual grouping the user expects — one card per platform with all pages

## Root Cause

The backend (`social-publish/index.ts`) **already handles multi-page publishing** in a single call. It splits `page_name` by comma and iterates internally (lines 241–283). The frontend clone logic is redundant and conflicts with this.

## Fix

### 1. Remove clone logic from `PostReviewPanel.tsx` (lines ~1141–1212)

Instead of creating combos per page and cloning, group by **platform only**:

```
For each publishable platform:
  1. Update original row → set platform + page_name (all selected pages, comma-joined)
  2. Call publishPost once with all pages
  
If multiple platforms:
  - First platform: use original row
  - Additional platforms: clone once per platform (not per page)
  - Each clone gets ALL selected pages in its page_name field
```

This means a post with 5 pages across Facebook + Instagram + LinkedIn creates at most 3 rows (1 original + 2 clones), not 15. Each row keeps `page_name = "Page1, Page2, Page3, Page4, Page5"`.

### 2. Keep backend unchanged

The backend's multi-page loop (`individualPages`) already handles comma-separated pages correctly. No changes needed.

### 3. Calendar display stays correct

`SocialCalendar.tsx` already parses `page_name.split(", ")` to show "Pages (5)" with per-page status indicators. No changes needed.

## Files Changed

| File | Change |
|------|--------|
| `src/components/social/PostReviewPanel.tsx` | Replace per-page clone logic with per-platform grouping; each row keeps all pages |

## Safety
- No database changes
- Backend unchanged — already supports multi-page in single call
- Calendar display unchanged — already groups by comma-separated pages
- Reduces DB writes from N×M to N (platforms only)

