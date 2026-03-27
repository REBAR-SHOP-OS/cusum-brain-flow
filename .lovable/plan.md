

# Fix: Pending Approvals Showing Published/Declined Posts + Missing Page Name

## Root Cause

Two issues in `ApprovalsPanel.tsx`:

1. **Stale approvals**: `pendingApprovals` filters by `approval.status === "pending"` in the approvals table, but doesn't cross-check the linked post's actual status. A post can be published/declined while its approval record remains "pending" (race condition or manual status change). These ghost approvals clutter the queue.

2. **Missing page/platform context**: Each card shows the platform badge but not `post.page_name`, which tells the manager *which specific page* the post targets (e.g., "REBAR Co. Facebook" vs "REBAR Instagram").

## Fix

### `src/components/social/ApprovalsPanel.tsx`

**1. Filter out approvals where the post is already resolved (line 60-62):**

Add a post-status guard after the existing `if (!post) return null`:

```tsx
const post = getPost(approval.post_id);
if (!post) return null;
// Skip if post is already published, declined, or failed
if (["published", "declined", "failed"].includes(post.status)) return null;
```

**2. Show `page_name` on each card (after platform badge, ~line 78-79):**

```tsx
<Badge className={cn("text-[10px]", platformColors[post.platform])}>
  {post.platform}
</Badge>
{post.page_name && (
  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
    {post.page_name}
  </span>
)}
```

**3. Update pending count in header to reflect filtered list:**

Move the filtering logic before the render so the count is accurate:

```tsx
const trulyPending = pendingApprovals.filter((a) => {
  const post = getPost(a.post_id);
  return post && !["published", "declined", "failed"].includes(post.status);
});
```

Use `trulyPending` instead of `pendingApprovals` for the list render and count display.

## Files Changed
- `src/components/social/ApprovalsPanel.tsx` — filter out resolved posts + show page_name

