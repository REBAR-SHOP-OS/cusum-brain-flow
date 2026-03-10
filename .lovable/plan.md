

# Audit: Why Social Post Scheduling Never Persists

## Investigation Summary

After exhaustive DB and code audit:

- **25 total posts** in DB. **Zero** have ever reached `status = 'scheduled'`. All are `draft` or `published`.
- **4 published posts** have `qa_status = 'needs_review'` — these predate the trigger, proving the trigger IS active and blocking invalid transitions.
- The cron job runs every minute, consistently finds 0 posts to publish.
- DB trigger, RLS, CHECK constraints all look correct for the values the code sends.

## Root Cause: Two Obstacles Found

### Obstacle 1: "Set Date" handler silently fails due to stale `post` object

In `PostReviewPanel.tsx` line 424-463, when the user clicks "Set Date", `onSetDate` fires `updatePost.mutate(...)`. But the `post` object is a **prop from the parent** — it's a snapshot from the last React Query fetch. If the mutation's `onSuccess` invalidates queries (which it does at line 104-106), React Query refetches, the parent re-renders with new data, and the **closure's `post.id` may reference a stale object**. More critically, the verification query at line 439-451 uses `.single()` which throws if zero rows match — this could happen if the post ID is somehow wrong.

### Obstacle 2: No error visibility — errors shown in Farsi with wrong context

All error toasts are in Farsi (lines 446-448, 456-458) with messages like "محتوا باید حداقل ۲۰ کاراکتر باشد" (content must be 20+ chars) even when the actual failure is RLS/permission related. The user may be seeing these errors but not understanding them or dismissing them.

### Obstacle 3: Race condition — mutation-level onSuccess invalidates cache before call-site onSuccess verifies

The `useSocialPosts` mutation-level `onSuccess` (line 104) calls `invalidateQueries`, which triggers a refetch. The call-site `onSuccess` (line 438) then tries to verify the DB. But the React Query refetch may cause the component to unmount/re-render, aborting the verification callback.

## Plan

### 1. Add a dedicated `schedule-post` edge function (service role, bypasses RLS)

Create `supabase/functions/schedule-post/index.ts` that:
- Accepts `{ post_id, scheduled_date, qa_status, platform, page_name }`
- Authenticates the user via JWT
- Checks user is in social team
- Updates the post using **service role key** (bypasses RLS)
- Returns the updated row or error with full details

This eliminates RLS as a potential silent failure point.

### 2. Update `PostReviewPanel.tsx` — Use edge function for scheduling

Replace the `updatePost.mutate` call in the "Set Date" handler (line 429) and "Schedule" button (line 591) with a direct call to the new edge function. Show clear English error messages with full context.

### 3. Update `SchedulePopover.tsx` — Same edge function approach

Replace the `updatePost.mutate` call with the edge function.

### 4. Add comprehensive console.log diagnostics

Log before mutation, after response, and on verification — with full payload and response details — so any future failures are immediately diagnosable.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/schedule-post/index.ts` | **New** — edge function to schedule posts via service role |
| `src/components/social/PostReviewPanel.tsx` | Use edge function for both "Set Date" and "Schedule" flows; English error messages |
| `src/components/social/SchedulePopover.tsx` | Use edge function; English error messages |
| `src/hooks/useSocialPosts.ts` | Add more diagnostic logging to updatePost |

