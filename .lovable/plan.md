

## Fix Platform & Pages Changes Not Applying to Card

### Root Cause

`groupPages` is stored as independent state in `SocialMediaManager.tsx`, set only when a card is clicked. After saving platform/page changes in the sub-panel:
1. DB is updated and queries are invalidated
2. `selectedPost` refreshes correctly (derived from query data)
3. But `groupPages` stays **stale** — still holding the values from the original card click
4. The sync `useEffect` in `PostReviewPanel` (line 205) runs on post change and resets `localPages` from stale `groupPages`, overwriting the just-saved values

Additionally, `handlePlatformsSaveMulti` only saves `sanitized[0]` to existing rows — it doesn't create new sibling rows for additional platforms.

### Fix

**File: `src/pages/SocialMediaManager.tsx`**

Replace `groupPages` state with a `useMemo` derived from current `posts` and `selectedPost`. This ensures it always reflects the latest DB state after any mutation:

```typescript
const groupPages = useMemo(() => {
  if (!selectedPost) return [];
  const siblings = posts.filter(s =>
    s.title === selectedPost.title &&
    s.platform === selectedPost.platform &&
    s.scheduled_date === selectedPost.scheduled_date
  );
  return [...new Set(siblings.map(s => s.page_name).filter(Boolean))] as string[];
}, [selectedPost, posts]);
```

Remove `setGroupPages` calls from `onPostClick`, `onGroupClick`, and `onClose`.

**File: `src/components/social/PostReviewPanel.tsx`**

Fix `handlePlatformsSaveMulti` to handle multi-platform properly — create new sibling rows for additional platforms (similar to how `handlePagesSaveMulti` creates rows for new pages):

1. Keep existing rows updated to first platform
2. For each additional platform, clone sibling rows with the new platform
3. Properly reconcile: delete rows for deselected platforms, create for new ones

| File | Change |
|---|---|
| `src/pages/SocialMediaManager.tsx` | Derive `groupPages` via `useMemo` instead of stale state |
| `src/components/social/PostReviewPanel.tsx` | Fix `handlePlatformsSaveMulti` to create/delete rows for multi-platform changes |

