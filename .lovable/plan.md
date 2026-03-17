

# Fix: Duplicate Hashtags in Published Social Posts

## Root Cause

The `content` field in `social_posts` already contains hashtags inline (confirmed by DB query). Then both publishing paths append `post.hashtags.join(" ")` again:

1. **`usePublishPost.ts` line 47-50** — client-side manual "Publish Now"
2. **`social-cron-publish/index.ts` line 152-155** — automated cron publishing

This causes every published post to have hashtags written twice.

## Fix

In both files, before appending hashtags from the array, check whether the content already contains them. If the content already has `#` hashtag patterns, skip appending.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/usePublishPost.ts` | Check if `cleanContent` already contains hashtags before appending `post.hashtags` |
| `supabase/functions/social-cron-publish/index.ts` | Same check: skip appending hashtags if content already has them |
| Redeploy `social-cron-publish` | |

### Logic (both files)

```typescript
const contentHasHashtags = /#[a-zA-Z]\w/.test(cleanContent);
const message = contentHasHashtags
  ? cleanContent
  : [cleanContent, post.hashtags.length > 0 ? "\n\n" + post.hashtags.join(" ") : ""].join("");
```

This ensures hashtags appear exactly once regardless of whether they were embedded in the caption or stored separately.

