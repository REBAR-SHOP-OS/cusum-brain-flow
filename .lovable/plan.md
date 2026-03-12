

# Fix "Total Posts" Counter Logic

## Problem
The "Total posts" counter currently shows `posts.length` which counts every DB row regardless of status. The correct logic should count the total number of **page instances across all scheduled/published cards** — i.e., each card's `×N` page count contributes to the total.

Since each page instance is already a separate DB row in `social_posts`, the fix is to filter to only count posts that are **scheduled** or **published** (not drafts, pending_approval, or declined).

## Change

### File: `src/pages/SocialMediaManager.tsx` (line 326)

Replace:
```tsx
<p className="text-xl sm:text-2xl font-bold">{posts.length}</p>
```

With:
```tsx
<p className="text-xl sm:text-2xl font-bold">
  {posts.filter((p) => p.status === "scheduled" || p.status === "published").length}
</p>
```

This way, a card scheduled to 6 pages = 6 DB rows with status "scheduled" = contributes 6 to the total. Three such cards = 18 total posts.

One line change, no new files or database changes needed.

