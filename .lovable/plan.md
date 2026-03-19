

# Fix: Apply Page/Platform/Content-Type Changes to All Sibling Posts

## Problem

When clicking a calendar card (e.g., "×13"), it represents a group of sibling posts (same platform + title + scheduled day). The review panel opens with the first post. When the user changes Pages and clicks Save, only that single post is updated — the other 12 siblings keep their old `page_name`. Same issue exists for platform and content_type saves.

Delete and date-change already handle siblings correctly (they query all matching posts). The save handlers for pages, platform, and content_type do not.

## Changes

### File: `src/components/social/PostReviewPanel.tsx`

**1. Extract a sibling-finder helper** (reuse the same logic already in the delete handler):
```
const getSiblingIds = () => {
  const postDay = post.scheduled_date?.substring(0, 10);
  const siblings = allPosts.filter(p =>
    p.platform === post.platform &&
    p.title === post.title &&
    p.scheduled_date?.substring(0, 10) === postDay
  );
  return siblings.length > 0 ? siblings.map(s => s.id) : [post.id];
};
```

**2. Update `handlePagesSaveMulti`** — mutate all siblings:
```
const handlePagesSaveMulti = (values: string[]) => {
  setLocalPages(values);
  const ids = getSiblingIds();
  ids.forEach(id => updatePost.mutate({ id, page_name: values.join(", ") }));
  setSubPanel(null);
};
```

**3. Update `handlePlatformsSaveMulti`** — mutate all siblings:
```
ids.forEach(id => updatePost.mutate({ id, platform: dbPlatform }));
```

**4. Update `handleContentTypeSave`** — mutate all siblings:
```
ids.forEach(id => updatePost.mutate({ id, content_type: value }));
```

## Result
When the user selects pages (e.g., "Rebar.shop") and clicks Save, all posts in that calendar card group will be updated — not just the first one.

