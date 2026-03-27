

# Fix: Status Filter Showing Wrong Posts in Published/Declined Tabs

## Problem

In `SocialMediaManager.tsx` line 143-147, the catch-all `else if (statusFilter !== "all")` branch adds `|| p.status === "scheduled" || p.status === "published"` to every non-all filter. This means:
- **Published tab** shows published + scheduled posts
- **Declined tab** shows declined + scheduled + published posts
- **Drafts tab** shows drafts + scheduled + published posts

The comment says "Always keep scheduled + published visible" but that defeats the purpose of filtering by status.

## Fix

Replace the catch-all filter (lines 143-147) with strict equality — only show posts matching the selected status:

```typescript
} else if (statusFilter !== "all") {
  items = items.filter((p) => p.status === statusFilter);
}
```

This one-line change ensures each status tab shows only its own posts.

## File Changed
- `src/pages/SocialMediaManager.tsx` — line 145-146: remove `|| p.status === "scheduled" || p.status === "published"` from filter

