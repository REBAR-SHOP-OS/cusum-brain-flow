

# Show Placeholder Cards as 5 Separate Cards (Not Grouped)

## Problem
The `groupByPlatform` function groups all "unassigned" posts into a single card showing "×3" (or ×5). The user wants each placeholder "?" card to appear individually — 5 separate cards at the 5 different time slots.

## Root Cause
All 5 placeholders share `platform: "unassigned"`, so `groupByPlatform` merges them into one grouped card.

## Solution

### File: `src/components/social/SocialCalendar.tsx`

1. **Render each post individually instead of grouping by platform** — Replace the `groupByPlatform` rendering with a flat list where each post gets its own card. Each card shows:
   - Platform icon
   - Page name or platform label
   - Time (e.g., 6:30 AM, 7:30 AM, etc.)
   - Status label
   - Selection checkbox

2. **Keep sorting** — Sort posts by `scheduled_date` ascending so they appear in chronological order within each day column.

This means ALL posts render individually (not just placeholders), which gives the user full visibility into every single post.

## Result
- 5 placeholder "?" cards appear as 5 separate entries at their respective times
- All other posts also render individually (no more hidden grouping)
- Each card is independently selectable and clickable

## Files Changed
- `src/components/social/SocialCalendar.tsx` — replace grouped rendering with individual post cards

