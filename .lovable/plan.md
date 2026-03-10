

# Fix: Persist Platform & Page Selection from Saved Post Data

## Problem
When opening a post's review panel, the platform and page dropdowns always show hardcoded defaults (`"facebook"` and `"Ontario Steel Detailing"`) instead of reading the values actually saved on the post (`post.platform` and `post.page_name`). After refresh, users can't see which platform/page was assigned.

## Root Cause
- `localPlatforms` initializes from `post?.platform` but only on first mount — if `post` is null initially (loading), it falls back to `"facebook"`.
- `localPages` always hardcodes `["Ontario Steel Detailing"]` regardless of what's saved.
- There is **no `useEffect`** to sync these states when the `post` object loads or changes (e.g. navigating between posts).

## Fix — `src/components/social/PostReviewPanel.tsx`

### 1. Initialize from post data
```typescript
const [localPages, setLocalPages] = useState<string[]>(
  post?.page_name ? [post.page_name] : ["Ontario Steel Detailing"]
);
const [localPlatforms, setLocalPlatforms] = useState<string[]>(
  [post?.platform || "facebook"]
);
const [localContentType, setLocalContentType] = useState(
  post?.content_type || "post"
);
```

### 2. Add sync effect when post changes (e.g. switching between posts in the review queue)
```typescript
useEffect(() => {
  if (!post) return;
  setLocalPlatforms([post.platform]);
  setLocalPages(post.page_name ? [post.page_name] : ["Ontario Steel Detailing"]);
  setLocalContentType(post.content_type || "post");
}, [post?.id]);
```

This ensures that every time a different post is opened (or the same post reloads after refresh), the UI shows the **saved** platform and page — not defaults.

### File Modified
- `src/components/social/PostReviewPanel.tsx` — add `useEffect` + fix initializers

