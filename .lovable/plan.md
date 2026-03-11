

## Hide Unassigned Posts from Calendar

### Problem
Posts with `platform: "unassigned"` (shown with a `?` icon) appear on the calendar. The user wants these hidden — only posts with a real platform should be visible.

### Solution
Filter out `unassigned` posts in the `SocialCalendar` component when building `dayPosts`.

### File: `src/components/social/SocialCalendar.tsx`

**Line 110-113** — add filter to exclude unassigned:
```typescript
const dayPosts = posts.filter((post) => {
  if (!post.scheduled_date) return false;
  if (post.platform === "unassigned") return false;
  return isSameDay(parseISO(post.scheduled_date), day);
});
```

Single line addition. Unassigned posts remain in the database and are accessible via other views (e.g., post review panel), but won't clutter the calendar.

