

## Plan: Always Show Scheduled & Published Posts (Never Filter Them Out)

### Problem
When a status filter (e.g., "Pending Approval", "Drafts", "Declined") is selected, scheduled and published posts are hidden from the calendar. The user requires that **scheduled and published posts must always be visible** regardless of any active filters.

### Solution
Modify the `filteredPosts` logic in `SocialMediaManager.tsx` so that scheduled and published posts are always included in the results, even when a status filter is active.

**File: `src/pages/SocialMediaManager.tsx`** (lines 104-133)

Change the filtering logic so that:
1. Platform filter still applies to all posts (including scheduled/published)
2. Search filter still applies to all posts
3. **Status filter**: When filtering by a specific status (e.g., "draft", "declined", "pending_approval"), **also include** all posts with `status === "scheduled"` or `status === "published"` — they are never excluded
4. The "approved_by_neel" special filter remains as-is (it already only shows approved posts which are scheduled/published)

```typescript
// Updated filteredPosts logic
const filteredPosts = useMemo(() => {
  let items = posts;
  if (platformFilter !== "all") {
    items = items.filter((p) => p.platform === platformFilter);
  }
  if (statusFilter === "approved_by_neel") {
    items = items.filter((p) => p.neel_approved);
  } else if (statusFilter === "pending_approval") {
    items = items.filter(
      (p) => (p.status === "scheduled" && !p.neel_approved) || p.status === "published" || p.status === "scheduled"
    );
  } else if (statusFilter !== "all") {
    // Always keep scheduled + published, plus the selected status
    items = items.filter(
      (p) => p.status === statusFilter || p.status === "scheduled" || p.status === "published"
    );
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    items = items.filter(
      (p) =>
        // Always keep scheduled/published even if they don't match search
        p.status === "scheduled" || p.status === "published" ||
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.hashtags.some((h) => h.toLowerCase().includes(q))
    );
  }
  return items;
}, [posts, platformFilter, statusFilter, searchQuery]);
```

### Files to Modify
- `src/pages/SocialMediaManager.tsx` — Update `filteredPosts` memo (lines 104-133)

