

## Remove Post Grouping — Show Individual Platform Cards

### What
Remove the `groupPostsByContent` logic from `SocialCalendar.tsx`. Each post should render as its own separate card with a single platform icon, exactly as it exists in the database. No merging of same-title posts.

### Changes

**`src/components/social/SocialCalendar.tsx`**
- Remove `groupPostsByContent` function and `PostGroup` interface
- Replace the grouped rendering loop with a flat loop over `dayPosts`
- Each card shows: one platform icon, title (truncated), status
- Selection checkbox targets individual post ID
- Clicking a card calls `onPostClick(post)` or `onToggleSelect(post.id)`

