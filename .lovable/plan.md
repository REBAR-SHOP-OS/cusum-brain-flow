

# Persist Platform & Pages Changes to Database for All Users

## Problem
When any user (radin, zahra, neel) changes the **platforms**, **pages**, or **content type** on a post card, those changes are stored only in React local state (`useState`). They are **never saved to the database**. So:
- Other users don't see the changes
- Refreshing the page loses the changes
- Only the platform's first value is partially saved via `updatePost.mutate`

## Root Cause
- `handlePagesSaveMulti` → only calls `setLocalPages(values)`, never writes to DB
- `handleContentTypeSave` → only calls `setLocalContentType(value)`, never writes to DB  
- `handlePlatformsSaveMulti` → saves only the first platform to DB, ignores the rest
- The `page_name` DB column is a single string, but the UI allows multi-select pages

## Solution

### 1. `src/components/social/PostReviewPanel.tsx` — Persist all field changes to DB

**Pages**: In `handlePagesSaveMulti`, after setting local state, call `updatePost.mutate` to save the joined page names:
```typescript
const handlePagesSaveMulti = (values: string[]) => {
  setLocalPages(values);
  updatePost.mutate({ id: post.id, page_name: values.join(", ") });
  setSubPanel(null);
};
```

**Content type**: In `handleContentTypeSave`, persist to DB:
```typescript
const handleContentTypeSave = (value: string) => {
  setLocalContentType(value);
  updatePost.mutate({ id: post.id, content_type: value });
  setSubPanel(null);
};
```

**Platforms**: In `handlePlatformsSaveMulti`, also save all selected platforms as a comma-separated string in `page_name` context (platforms are already saved, but ensure the full list is persisted properly).

### 2. Sync `localPages` from DB value on load

Update the `useEffect` sync block (~line 188) to properly parse `page_name` when it contains comma-separated values:
```typescript
setLocalPages(post.page_name ? post.page_name.split(", ").filter(Boolean) : ["Ontario Steel Detailing"]);
```

### 3. Realtime already configured
The `useSocialPosts` hook already has a realtime subscription on `social_posts` table, so when one user saves changes, other users' views will auto-refresh via query invalidation.

## Files
- `src/components/social/PostReviewPanel.tsx` — persist pages, content_type, and platforms to DB on change

