

# Plan: Replace Schedule Popover with Direct Schedule Button

## What
Replace the `SchedulePopover` (which opens a multi-step date/platform picker) with a simple "Schedule" button that immediately schedules the post using the **already-set** publish date and platform/pages from the post detail panel.

## Why
The post already has its scheduled date, platform, and pages configured in the panel fields above. The Schedule button should just confirm and save — no need to re-pick date/platforms.

## Changes

### `src/components/social/PostReviewPanel.tsx`
- Remove `SchedulePopover` import
- Replace `<SchedulePopover post={post} onScheduled={onClose} />` (line 511) with a simple `<Button>` that:
  1. Validates that `post.scheduled_date` is set (show toast error if not)
  2. Calls `updatePost.mutate()` to set `status: "scheduled"`, `qa_status: "scheduled"`, `page_name: localPages[0]`
  3. For additional pages in `localPages`, inserts duplicate posts via `supabase.from("social_posts").insert(...)` (same logic as current SchedulePopover)
  4. Shows success toast and calls `onClose()`

### No other files changed
- `SchedulePopover.tsx` can remain (unused) or be removed — no breaking changes either way

