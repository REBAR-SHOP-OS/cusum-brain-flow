

## Plan: Update Existing Scheduled Posts Instead of Cloning on Reschedule

### Problem
When a post is already scheduled and a user edits it then reschedules, the edge function creates new clone posts for extra platform combos instead of updating the existing ones. This results in duplicate cards.

### Root Cause
In `supabase/functions/schedule-post/index.ts` lines 158-200 (the "NORMAL flow" for non-unassigned posts), when `extra_combos` are provided, the code checks for duplicates by title+platform+day — but if found, it just **skips** the combo silently. It should instead **update** the existing post with the new scheduled date.

### Changes

**1. `supabase/functions/schedule-post/index.ts` (lines 158-200)**
- In the extra_combos loop for the NORMAL flow: when a duplicate is found (existing post with same title+platform+page on same day), **update** that existing post's `scheduled_date`, `status`, `qa_status`, `content`, `image_url`, `hashtags` instead of skipping it
- Same fix for the UNASSIGNED flow (lines 54-93): update existing instead of skipping

**2. `src/components/social/SchedulePopover.tsx`**
- When `post.status === "scheduled"` and only one platform is selected (same as the post's current platform), ensure we just do a simple update (no extra_combos) — this already works correctly via the NORMAL flow

### Technical Detail
In both the unassigned and normal flow loops, change:
```
if (existing && existing.length > 0) {
  console.warn("Duplicate skipped...");
  continue;  // ← currently skips
}
```
To:
```
if (existing && existing.length > 0) {
  // UPDATE the existing post instead of skipping
  await serviceClient.from("social_posts")
    .update({ scheduled_date, status: "scheduled", qa_status: "scheduled",
              content: fullPost.content, image_url: fullPost.image_url, hashtags: fullPost.hashtags })
    .eq("id", existing[0].id);
  cloned.push(existing[0].id);
  continue;
}
```

### Files
- `supabase/functions/schedule-post/index.ts` — update existing posts instead of skipping duplicates

