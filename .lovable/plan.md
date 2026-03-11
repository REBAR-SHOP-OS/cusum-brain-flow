

## Show Unassigned Posts on Calendar

### Problem
The filter added in the previous step (`if (post.platform === "unassigned") return false`) hides ALL unassigned posts from the calendar. The user wants the 5 auto-generated posts (at 6:30, 7:30, 8:00, 12:30, 2:30) to appear as `?` cards on the calendar.

### Solution
Remove the `unassigned` filter from `SocialCalendar.tsx` line 112. Unassigned posts will show with the existing `?` icon defined in `platformIcons.unassigned`.

### File: `src/components/social/SocialCalendar.tsx`

**Line 112** — remove the filter line:
```typescript
// Before
const dayPosts = posts.filter((post) => {
  if (!post.scheduled_date) return false;
  if (post.platform === "unassigned") return false;
  return isSameDay(parseISO(post.scheduled_date), day);
});

// After
const dayPosts = posts.filter((post) => {
  if (!post.scheduled_date) return false;
  return isSameDay(parseISO(post.scheduled_date), day);
});
```

One line removal. The `?` icon is already defined in `platformIcons.unassigned`. Once a user assigns platforms to a post (changing its `platform` field), it will display with the correct platform icon instead.

