

# Show Pending Approval Posts in Calendar View (Same as "All")

## Problem
When "Pending Approval" filter is selected, posts are shown in a simplified flat list instead of the same calendar card layout used by all other status filters. The user wants consistent UI.

## Solution

In `src/pages/SocialMediaManager.tsx`:

1. **Remove the special `pending_approval` branch** (lines 518-581) from the rendering conditional
2. **Show the date navigation** for pending approval too — remove the `statusFilter !== "pending_approval"` guard (line 491)
3. The existing `SocialCalendar` component at the bottom of the conditional already receives `filteredPosts`, which is already filtered by status. So pending approval posts will naturally show in the calendar grid, grouped by date with the same card layout as "All".

This is a minimal change — just removing the special-case branch so pending approval uses the same calendar rendering path as drafts, scheduled, published, and declined filters.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/SocialMediaManager.tsx` | Remove `pending_approval` special rendering branch; remove date nav guard |

