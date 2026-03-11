
## Diagnosis: Facebook "Failed" Posts

### Root Cause
The 3 Facebook posts (pages: Rebar.shop, Ontario Steels, Ontario Logistics) were approved by Neel and the cron tried to publish them at 17:15 UTC. They all failed and were marked `status: 'failed'`. The actual Facebook API error has been lost due to log rotation.

Possible causes (cannot confirm without logs):
- Facebook page access token expired
- Facebook app missing `pages_manage_posts` or `pages_read_engagement` permission
- Facebook rejected the image URL (Supabase storage URL)

The cron function has two critical gaps that make this impossible to properly debug and recover from:

1. **No detailed error persistence**: The Facebook API error message is logged to console but not saved anywhere persistent (e.g., a column on the post). When logs rotate, the error is lost forever.
2. **No retry mechanism**: Once a post is marked "failed", there's no way to retry it from the UI. The user must manually change the status in the database.

### Fix Plan (3 changes)

**1. `supabase/functions/social-cron-publish/index.ts`** — Save error message to database + add verbose logging
- Add `console.error` with the full `publishResult.error` for every failure
- Save the error message to a new approach: store it in the post's existing fields or add logging
- When image publishing fails, retry as text-only post (fallback)

**2. `src/components/social/PostReviewPanel.tsx`** — Add "Retry" button for failed posts
- When `post.status === 'failed'`, show a "Retry" button that resets the post to `status: 'scheduled', qa_status: 'scheduled'`
- This allows Neel to retry publishing without database access

**3. Database** — Add `last_error` column to `social_posts` table
- Store the actual API error message so it persists across log rotations
- Display this error in the PostReviewPanel for failed posts so the user knows WHY it failed

### Technical Details

**Cron publish error persistence** (`social-cron-publish`):
```typescript
// Before: error only logged to console (lost on rotation)
if (publishResult.error) {
  await supabase.from("social_posts")
    .update({ status: "failed", qa_status: "needs_review" })
    .eq("id", post.id);
}

// After: error saved to database + image fallback
if (publishResult.error && post.image_url) {
  console.error(`[cron] Image publish failed: ${publishResult.error}. Retrying text-only...`);
  publishResult = await publishToFacebook(pageId, pageAccessToken, message, null);
}
if (publishResult.error) {
  await supabase.from("social_posts")
    .update({ status: "failed", qa_status: "needs_review", last_error: publishResult.error })
    .eq("id", post.id);
}
```

**Retry button** (`PostReviewPanel.tsx`):
```typescript
// Show retry button for failed posts
{post.status === "failed" && (
  <Button onClick={() => updatePost.mutateAsync({
    id: post.id, status: "scheduled", qa_status: "scheduled"
  })}>
    Retry Publishing
  </Button>
)}
// Show last_error if available
{post.last_error && <p className="text-red-400 text-xs">{post.last_error}</p>}
```

**Migration**: `ALTER TABLE social_posts ADD COLUMN last_error text;`
