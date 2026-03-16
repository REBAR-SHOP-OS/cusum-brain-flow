

# Fix: Stories should not remain on "unassigned" platform

## Problem
When "Auto Generate Story" runs, it sets `content_type: "story"` but keeps the post's platform as `"unassigned"`. The publish validation correctly rejects "unassigned" — but the user shouldn't have to manually fix this every time.

## Root Fix

**`src/components/social/PostReviewPanel.tsx`** — line ~996, in the `onImageReady` callback for story generation:

When auto-generating a story, if the current platform is `"unassigned"`, auto-set it to a default publishable platform (e.g. `"instagram"` since stories are primarily an Instagram format):

```tsx
onImageReady={(url) => {
  setShowStoryGen(false);
  setLocalContentType("story");
  
  // Root fix: auto-assign a publishable platform if currently unassigned
  const needsPlatform = localPlatforms.length === 0 || 
    (localPlatforms.length === 1 && localPlatforms[0] === "unassigned");
  const newPlatforms = needsPlatform ? ["instagram"] : localPlatforms;
  if (needsPlatform) {
    setLocalPlatforms(newPlatforms);
  }

  updatePost.mutate({
    id: post.id,
    content_type: "story",
    content: "",
    title: "",
    hashtags: [],
    ...(needsPlatform ? { platform: "instagram" } : {}),
  });
  handleMediaReady(url, "image");
}}
```

This is a single-location change. After this fix, auto-generated stories will default to Instagram (the most natural story platform) instead of staying on "unassigned", eliminating the publish error.

