

# Fix: Platform & Page Save Creating Duplicate Posts

## Problem

When editing a post in the PostReviewPanel and saving platform or page selections, the system creates **new duplicate draft rows** instead of recognizing existing sibling rows. Two root causes:

### Cause 1: Platform aliasing mismatch
`platformMap` maps `instagram_fb → instagram` and `linkedin_org → linkedin`. But `localPlatforms` is initialized as `[post.platform]` (e.g. `"instagram"`), and the UI options include `instagram_fb` as a separate entry. When reconciliation compares DB siblings (platform = `"instagram"`) against mapped UI values, it can misidentify rows as needing creation.

Additionally, `localPlatforms` starts with only the **current post's** platform — it doesn't include sibling platforms (e.g. if Facebook + Instagram + LinkedIn siblings exist, it only shows the one you clicked). So selecting the other two feels like "adding" them and creates duplicates.

### Cause 2: Page reconciliation ignores existing siblings
`localPages` is initialized from `post.page_name` (single value) or `groupPages`. When saving, `handlePagesSaveMulti` compares selected pages against siblings found via `allPosts.filter(...)`. If the `allPosts` cache is stale or the sibling query doesn't match correctly, pages that already have rows get re-inserted.

## Fix

### 1. Initialize `localPlatforms` from all siblings — `PostReviewPanel.tsx` (line ~207)

Instead of `setLocalPlatforms([post.platform])`, derive from all siblings sharing the same title + day:

```typescript
const day = post.scheduled_date?.substring(0, 10);
const siblingPlatforms = [...new Set(
  allPosts
    .filter(p => p.title === post.title && p.scheduled_date?.substring(0, 10) === day)
    .map(p => p.platform)
)];
setLocalPlatforms(siblingPlatforms.length > 0 ? siblingPlatforms : [post.platform]);
```

### 2. Fix platform aliasing in `handlePlatformsSaveMulti` (line ~375)

The `platformMap` collapses `instagram_fb → instagram`, but the reconciliation then compares against DB rows that already have `platform = "instagram"`. The comparison uses `existingSet.has(p)` where `p` is the mapped value — this should work. But the issue is that when `sanitized` contains `"instagram"` AND `"instagram_fb"`, both map to `"instagram"`, creating a duplicate insert attempt. 

**Fix**: Deduplicate `dbPlatforms` after mapping:
```typescript
const dbPlatforms = [...new Set(sanitized.map(p => platformMap[p] || p))];
```

### 3. Add guard in `handlePagesSaveMulti` (line ~479)

Before inserting, verify the page doesn't already exist by checking the current DB state:
```typescript
// Query current siblings from DB (not stale cache)
const { data: freshSiblings } = await supabase
  .from("social_posts")
  .select("id, page_name")
  .eq("platform", post.platform)
  .eq("title", post.title)
  .gte("scheduled_date", `${day}T00:00:00`)
  .lte("scheduled_date", `${day}T23:59:59`);

const existingPages = new Set((freshSiblings || []).map(s => s.page_name || ""));
const toAdd = values.filter(p => !existingPages.has(p));
```

## Files Changed

| File | Change |
|---|---|
| `src/components/social/PostReviewPanel.tsx` | 1) Init `localPlatforms` from all sibling platforms. 2) Deduplicate `dbPlatforms` after mapping. 3) Use fresh DB query in page reconciliation to prevent duplicate inserts. |

