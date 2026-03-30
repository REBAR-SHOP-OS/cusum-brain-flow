

# Fix: Unassigned "?" Cards Not Updating After Platform/Page Assignment

## Problem

When a "?" placeholder card gets a platform and pages assigned, it doesn't properly update because the sibling-matching logic in `handlePlatformsSaveMulti` uses `title + day` to find related posts. Since ALL auto-generated placeholder cards share `title: "?"`, this matches every `?` card on that day (e.g., all 5 cards at different times), instead of only the one at the specific time slot.

This causes the platform assignment to either fail silently or affect the wrong cards.

## Root Cause

**`PostReviewPanel.tsx` line 388-391**: Sibling filter uses `p.title === post.title` + same day. For `?` cards, `title` is always `"?"`, so all `?` cards on the same day are treated as siblings. The code then tries to delete all of them (since they're all `unassigned`) and create new rows, leading to incorrect behavior.

## Solution

### File: `src/components/social/PostReviewPanel.tsx`

**Refine sibling matching** to also compare `scheduled_date` (full timestamp, not just date). For `?` cards, each time slot is a distinct group:

```typescript
// Current (broken for "?" cards):
const siblings = allPosts.filter(p =>
  p.title === post.title &&
  (day ? p.scheduled_date?.substring(0, 10) === day : p.id === post.id)
);

// Fixed — also match on exact scheduled_date (time slot):
const siblings = allPosts.filter(p =>
  p.title === post.title &&
  p.scheduled_date === post.scheduled_date
);
```

This ensures:
- `?` card at 6:30 AM only matches other 6:30 AM cards with same title
- `?` card at 8:00 AM is treated independently
- Non-`?` cards (with real titles) still group correctly since they share both title and time

Apply the same fix to `handlePagesSaveMulti` (line 478-481) for consistency.

Also apply to `handleContentTypeSave` (line 451-461) which has the same day-only matching pattern.

## Result
- Assigning Instagram to the 8:00 AM `?` card deletes only that one `unassigned` row and creates an Instagram row at 8:00 AM
- Other `?` cards at different times remain untouched
- The "Unassigned" card disappears from the calendar after platform assignment

## Files Changed
- `src/components/social/PostReviewPanel.tsx` — fix sibling matching in `handlePlatformsSaveMulti`, `handlePagesSaveMulti`, and `handleContentTypeSave` to use exact `scheduled_date` instead of day-only

