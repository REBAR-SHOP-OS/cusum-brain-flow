

# Show Pending Approval Posts as Cards List

## Problem
When "Pending Approval" filter is clicked, only posts with `scheduled_date` in the current week are visible in the calendar. Pending posts without dates or in other weeks are invisible.

## Solution

When `statusFilter === "pending_approval"`, replace the calendar grid with a card-based list showing ALL filtered pending approval posts (not limited to current week). Each card shows platform icon, title, content preview, scheduled date (if any), and is clickable to open the PostReviewPanel.

### `src/pages/SocialMediaManager.tsx`

1. When `statusFilter === "pending_approval"`, hide the week navigation and calendar grid.
2. Instead, render a list/grid of cards from `filteredPosts` (which already filters by `pending_approval` status).
3. Each card displays: platform badge, title, content snippet, scheduled date, and image thumbnail if available.
4. Clicking a card opens PostReviewPanel (same as calendar click behavior).
5. Show count of pending posts and empty state if none exist.

### Files Changed
- `src/pages/SocialMediaManager.tsx` — add pending approval card list view alongside existing calendar view

