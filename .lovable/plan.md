

## Plan: Delete Entire Card (All Sibling Posts) on "Delete Post"

### Problem
When clicking "Delete post" in the review panel, only the single displayed post is deleted. The calendar card (which represents a group of posts sharing the same platform + title on the same day, e.g., ×3) still shows remaining siblings.

### How Groups Work
Posts are grouped in `SocialCalendar` by key `{platform}_{title}` per day. A ×3 card means 3 posts with the same platform and title on the same day (one per page). The user expects "Delete post" to remove the entire card — all siblings.

### Fix

**File: `src/components/social/PostReviewPanel.tsx`** — Update `handleDelete` (~lines 307-318):

1. Before deleting, find all sibling posts from `allPosts` that share the same `platform`, `title`, and `scheduled_date` (same day).
2. Delete all siblings using `Promise.all` with `deletePost.mutateAsync`.
3. Update the toast to reflect how many posts were deleted.

```typescript
const handleDelete = async () => {
  setDeleting(true);
  try {
    // Find all sibling posts in the same calendar card (same platform + title + day)
    const postDay = post.scheduled_date?.substring(0, 10);
    const siblings = allPosts.filter(p =>
      p.platform === post.platform &&
      p.title === post.title &&
      p.scheduled_date?.substring(0, 10) === postDay
    );
    const idsToDelete = siblings.length > 0 ? siblings.map(s => s.id) : [post.id];
    
    await Promise.all(idsToDelete.map(id => deletePost.mutateAsync(id)));
    toast({
      title: "Deleted",
      description: `${idsToDelete.length} post(s) deleted.`,
    });
  } finally {
    setDeleting(false);
    onClose();
  }
};
```

Single file change, no database or backend modifications needed.

