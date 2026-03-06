

# Fix: Calendar shows "All (7)" but no posts visible

## Problem
The platform filter badges (e.g. "All (7)") count **all posts across all dates**, but the calendar only renders posts for the **current week** (Mar 2–8). Since most posts have `scheduled_date` in February, the calendar appears empty despite the count showing 7.

## Fix — 2 changes in `src/pages/SocialMediaManager.tsx`

### 1. Make the count badges reflect the visible week
Change the `counts` memo (lines 97-103) to count only posts within the current week range, so the badge numbers match what's actually displayed on the calendar.

```tsx
const counts = useMemo(() => {
  const weekEnd = addDays(weekStart, 6);
  const weekPosts = filteredPosts.filter((p) => {
    if (!p.scheduled_date) return false;
    const d = parseISO(p.scheduled_date);
    return d >= weekStart && d <= addDays(weekEnd, 1); // within week
  });
  const c: Record<string, number> = { all: weekPosts.length };
  for (const p of weekPosts) {
    c[p.platform] = (c[p.platform] || 0) + 1;
  }
  return c;
}, [filteredPosts, weekStart]);
```

### 2. Add a "Jump to latest" hint when week is empty
When the calendar week has 0 posts but total posts exist, show a small message/button like "No posts this week — Jump to latest" that navigates to the week containing the most recent post.

### Import needed
Add `parseISO` to the `date-fns` import on line 11.

