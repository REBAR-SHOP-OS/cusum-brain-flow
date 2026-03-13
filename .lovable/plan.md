

# Pending Approval Cards: Vertical Column Layout + Date Sorting

## Changes

### `src/pages/SocialMediaManager.tsx`
1. Change the grid from `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` to a single-column vertical list (`flex flex-col gap-3`)
2. Sort `filteredPosts` by `scheduled_date` ascending (earliest first) when in pending approval view
3. Group posts by date with date headers (e.g., "Mar 18, 2026") for better readability

