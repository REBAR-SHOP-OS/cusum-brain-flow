

## Batch Neel Approval — Approve All Related Posts Together

### Problem
When Neel approves a post, only that single row in the database gets `neel_approved = true`. But posts are created in batches (same content + image across multiple pages/platforms). The other posts in the batch still show "Awaiting Neel's Approval" to radin and zahra.

**Database evidence:** 5 Facebook posts with identical `image_url` and `title` — only 1 has `neel_approved: true`.

### Solution
When Neel clicks "Neel Approval", update ALL posts that share the same `image_url` (the batch identifier) instead of just the clicked post.

### Changes

**`src/components/social/PostReviewPanel.tsx`** (lines 587-589)

Replace the single-post approval with a batch approval:

```typescript
onClick={async () => {
  // Approve all posts in the same batch (same image)
  const batchPosts = posts.filter(p => p.image_url === post.image_url);
  for (const p of batchPosts) {
    await updatePost.mutateAsync({ id: p.id, neel_approved: true } as any);
  }
  toast({ title: "Approved", description: `${batchPosts.length} post(s) approved by Neel.` });
}}
```

This requires access to the full `posts` array from `useSocialPosts`. I'll verify it's available in scope.

**Also: Fix the 4 currently stuck posts** — I'll note that after deployment, Neel will need to click "Neel Approval" on any one of the remaining unapproved Facebook posts to batch-approve them all. Alternatively, I can add a one-time DB fix in the migration.

