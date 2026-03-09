

# Why Your Scheduled Post Didn't Publish

## Investigation Results

### 1. Cron job works correctly
The `social-cron-publish` function runs every minute (confirmed by logs and direct curl test). It returned `"No posts due for publishing"` — meaning **there are zero posts with status "scheduled" in the database**.

### 2. The post doesn't exist in the database
I queried all 25 posts in `social_posts` — none are from March 9, none have status "scheduled", and none contain "Rebar Straight". The post you see as "Scheduled" in the UI **was never actually saved to the database**.

### 3. Root cause: silent mutation failure
When you pick a date or click Schedule, the code calls `updatePost.mutate()` which does:
```
supabase.from("social_posts").update({status: "scheduled", ...}).eq("id", post.id)
```
If this fails (RLS policy rejection, network error, stale post ID), the UI may briefly show "Scheduled" but the database never received the update. The error toast may have been missed or not shown clearly.

### 4. The RLS policy is restrictive
The `social_posts` table only allows updates for users with emails: `radin@rebar.shop`, `zahra@rebar.shop`, `neel@rebar.shop`. If you're logged in with a different email, all writes silently fail.

## Fix Plan

### Fix 1: Add confirmation verification after scheduling
After the `updatePost.mutate` succeeds, re-fetch the post from DB to verify it was actually saved. If the re-fetch shows the post is still "draft", show a clear error.

### Fix 2: Improve error feedback on Schedule button
Add explicit error handling with clear Persian/English toast messages when the schedule mutation fails, including the specific error reason.

### Fix 3: Add a "scheduled post verification" check
When displaying posts as "Scheduled" on the calendar, cross-check against the actual DB status to prevent showing phantom scheduled posts.

## Files to Edit
- `src/hooks/useSocialPosts.ts` — add verification after update mutation
- `src/components/social/PostReviewPanel.tsx` — improve error handling on Schedule button click
- `src/components/social/SocialCalendar.tsx` — only show "Scheduled" badge for DB-confirmed posts

## Immediate Action Needed
Please confirm: **which email are you logged in with?** If it's not one of `radin@`, `zahra@`, or `neel@rebar.shop`, that's why the post wasn't saved — the RLS policy blocks the write.

