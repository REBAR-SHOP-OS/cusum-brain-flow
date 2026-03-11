

## Move Select Checkbox to Each Day Header

### What
Remove the global "Select" button and "Select All" checkbox from the filter bar. Instead, add a small select/checkbox icon on each day's header in the calendar. Clicking it selects/deselects all posts for that specific day.

### Changes

**1. `src/components/social/SocialCalendar.tsx`**
- Add new prop: `onSelectDay?: (dayPostIds: string[]) => void`
- In each day header, when `onToggleSelect` is provided, render a checkbox icon
- Clicking it calls `onSelectDay` with all post IDs for that day (toggles them)
- Show checked state based on whether all day posts are already selected

**2. `src/pages/SocialMediaManager.tsx`**
- Remove the global "Select" toggle button and "Select All" checkbox from the filter bar
- Keep selection mode always available (no toggle needed) — just show delete bar when posts are selected
- Add `onSelectDay` handler that toggles all posts for that day
- Keep individual post toggle via `onToggleSelect`
- Pass `onSelectDay` to `SocialCalendar`
- Keep delete confirmation dialog and bulk delete logic as-is

### UI Behavior
- Each day column header shows a small checkbox (only when `selectionMode` is active)
- The global "Select" button stays to enter/exit selection mode
- Inside each day header: a checkbox that selects/deselects all posts of that day
- Remove the global "Select All" from the filter bar — per-day selection replaces it

