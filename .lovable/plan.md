

## Fix: Bulk delete should cascade to all sibling posts

### Problem
When using Selection Mode to delete posts, only the explicitly selected post IDs are deleted. But the established deletion logic (used in PostReviewPanel) requires that deleting a post also removes all sibling posts sharing the same `image_url` or `title`. This leaves orphan copies in the database.

### Solution
Update `handleBulkDelete` in `SocialMediaManager.tsx` to expand the selected IDs to include all sibling posts before deleting.

**`src/pages/SocialMediaManager.tsx`** — `handleBulkDelete` (line 140-149):

```typescript
const handleBulkDelete = useCallback(async () => {
  setBulkDeleting(true);
  
  // Expand selection to include all sibling posts (same image_url or title)
  const selectedPosts = posts.filter(p => selectedPostIds.has(p.id));
  const allIdsToDelete = new Set<string>(selectedPostIds);
  
  for (const sp of selectedPosts) {
    for (const p of posts) {
      if (allIdsToDelete.has(p.id)) continue;
      if ((sp.image_url && p.image_url === sp.image_url) ||
          (sp.title && p.title === sp.title)) {
        allIdsToDelete.add(p.id);
      }
    }
  }
  
  for (const id of allIdsToDelete) {
    await deletePost.mutateAsync(id);
  }
  
  setBulkDeleting(false);
  setShowDeleteConfirm(false);
  exitSelectionMode();
}, [selectedPostIds, posts, deletePost, exitSelectionMode]);
```

This mirrors the same sibling-matching logic from `PostReviewPanel.handleDelete`, ensuring consistent behavior across single and bulk deletion.

