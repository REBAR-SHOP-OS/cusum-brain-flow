

## Fix: Delete Unassigned Card After Schedule/Publish

### Problem
When an "unassigned" (question mark) post is scheduled or published with specific platforms/pages selected, the original unassigned card remains visible in the calendar. Only the new platform-specific cards should appear.

### Root Cause

**Publish flow**: In `PostReviewPanel.tsx` lines 862-912, the "Publish Now" button calls `publishPost()` for each platform×page combo using the **same original post ID**. It never deletes the original unassigned post afterward. The edge function `social-publish` just publishes to the API and updates that single row — it doesn't create per-platform clones or remove the unassigned original.

**Schedule flow via SocialMediaManager**: `handleSchedule` (line 224) does a simple `updatePost.mutate({ id, qa_status: "approved", status: "scheduled" })` — no unassigned handling at all. However, the PostReviewPanel's own Schedule button already handles this correctly with `delete_original: isUnassigned`.

### Plan

**File: `src/components/social/PostReviewPanel.tsx`** — Fix Publish Now for unassigned posts

1. After successfully publishing all combos for an unassigned post:
   - The publish edge function creates the published record on the first combo's post ID
   - For additional combos, clone the post (create new rows with `status: "published"` for each platform×page)
   - Delete the original unassigned post from the database
   - Invalidate the query cache

**File: `src/pages/SocialMediaManager.tsx`** — Fix `handleSchedule`

2. Update `handleSchedule` to check if the post is unassigned. If so, don't just update status — instead use the `schedulePost()` function with `delete_original: true` (same pattern as PostReviewPanel's Schedule button).

### Technical Detail

```text
Publish Now (unassigned post):
  Before: publishPost(same id) × N combos → original unassigned row stays
  After:  publishPost(first combo) → clone for remaining combos → delete original unassigned row

handleSchedule (SocialMediaManager):
  Before: updatePost.mutate({ status: "scheduled" })
  After:  if unassigned → schedulePost({ delete_original: true, extra_combos }) 
          else → existing behavior
```

