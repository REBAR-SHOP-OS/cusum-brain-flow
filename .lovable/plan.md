

# Fix: Platform Display "All" + Cron Must Publish & Mark as Published

## Problems Identified

1. **Platform display never shows "All"**: When all platforms are selected, the review panel lists each name individually instead of showing "All".

2. **Cron publish doesn't update `qa_status`**: The `social-cron-publish` function updates `status: "published"` but forgets to set `qa_status: "published"`. This means posts don't appear under the "Published" filter tab after the cron publishes them.

3. **Published tab filtering**: Posts published by the cron won't show in the Published category because `qa_status` remains `"scheduled"`.

## Changes

### 1. `src/components/social/PostReviewPanel.tsx` — Show "All" when all platforms selected

Change line 226 from individual name join to:
```typescript
const platformsDisplay = localPlatforms.length === PLATFORM_OPTIONS.length
  ? "All"
  : localPlatforms.map(p => PLATFORM_OPTIONS.find(o => o.value === p)?.label || p).join(", ");
```

### 2. `supabase/functions/social-cron-publish/index.ts` — Update `qa_status` on publish

**Line 115** (failure): Add `qa_status` update:
```typescript
await supabase.from("social_posts").update({ status: "failed", qa_status: "needs_review" }).eq("id", post.id);
```

**Line 118** (success): Add `qa_status` update:
```typescript
await supabase.from("social_posts").update({ status: "published", qa_status: "published" }).eq("id", post.id);
```

### Files Modified
- `src/components/social/PostReviewPanel.tsx` — 1 line change for "All" display
- `supabase/functions/social-cron-publish/index.ts` — 2 line changes for `qa_status` updates

