

# Fix: Scheduled Posts Not Publishing + Show "Published" Status

## Root Cause Analysis

After investigating the database, cron logs, and code:

1. **The cron job runs correctly every minute** and queries `status = 'scheduled' AND scheduled_date <= now()` — confirmed working.
2. **The cron consistently finds 0 posts** — meaning posts are NOT being saved with `status = 'scheduled'` in the database, even though the UI shows a success toast.
3. **Silent mutation failure**: The scheduling flow in `PostReviewPanel` closes the popover and shows a toast, but the database update may be rejected by the `block_social_publish_without_qa` trigger (e.g., content < 20 chars) or RLS, without the user knowing.
4. **No "Published" styling** in the calendar — `SocialCalendar.tsx` only styles `scheduled`, `draft`, and `declined`.

## Plan

### 1. Harden the scheduling flow in `PostReviewPanel.tsx`

**DateSchedulePopover path (line 424-443)**:
- Do NOT close the popover until mutation `onSuccess` fires
- Add verification query (like the "Approve and Schedule" button already has)
- Show error toast on failure

**"Approve and Schedule" button path (line 566-622)**:
- Already has verification — keep as-is
- Add content length pre-check before calling mutate (show toast if content < 20 chars)

### 2. Add content validation before scheduling

Both scheduling paths should check:
```typescript
if ((post.content || "").length < 20) {
  toast({ title: "Content too short", description: "Post content must be at least 20 characters to schedule.", variant: "destructive" });
  return;
}
```

This prevents the DB trigger from silently rejecting the update.

### 3. Improve cron robustness (`social-cron-publish/index.ts`)

- Add a secondary query for posts with `qa_status = 'scheduled'` and `scheduled_date <= now()` but `status = 'draft'` — auto-promote them to `scheduled` status first, then process
- Add detailed logging of each post's `scheduled_date` vs current time

### 4. Show "Published" status on calendar cards (`SocialCalendar.tsx`)

- Add green styling for `status === "published"` (currently falls into the gray default)
- Display "Published" text in green under the post title

### 5. Show "Published" in `PostReviewPanel.tsx`

- Update the status badge to show green "Published" when `post.status === "published"`

## Files to Change

| File | Change |
|------|--------|
| `src/components/social/PostReviewPanel.tsx` | Content length pre-check, fix DateSchedulePopover close timing, add verification |
| `src/components/social/SocialCalendar.tsx` | Add green "Published" styling for published posts |
| `supabase/functions/social-cron-publish/index.ts` | Add fallback query for `qa_status='scheduled'` + `status='draft'` posts, enhanced logging |
| `src/components/social/SchedulePopover.tsx` | Add same content length pre-check |

