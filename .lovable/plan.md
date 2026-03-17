

# Fix: Enforce Decline Lock and Approval Gate on Social Posts

## Problem
1. When neel/radin/zahra decline a post, it only sets `status: "declined"` — nothing prevents re-scheduling or publishing it
2. "Publish Now" sends `force_publish: true` which bypasses the `neel_approved` check in `social-publish`
3. The `schedule-post` edge function has zero approval checks

## Changes

### 1. Database: Add `declined_by` column
Add a `declined_by` text column to `social_posts` so declined posts carry the decliner's email. This creates a permanent lock — only the decliner (or a super-admin) could reverse it by explicitly re-approving.

Migration:
```sql
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS declined_by text;
```

### 2. Frontend: `SocialMediaManager.tsx` — handleDecline
Update to also set `neel_approved: false` and `declined_by: currentUserEmail` when declining. This resets any prior approval.

### 3. Edge Function: `social-publish/index.ts` — Block declined posts
After the duplicate-publish guard (line 105), add a check:
- If `post.status === 'declined'` → return 403 "This post was declined and cannot be published"
- **Remove the `force_publish` bypass** for the `neel_approved` check. ALL publishes (manual or cron) must have `neel_approved = true`

### 4. Edge Function: `schedule-post/index.ts` — Block declined + unapproved
Before updating the post, add:
- If `fullPost.status === 'declined'` → return 403 "Declined posts cannot be scheduled"
- (No approval check needed for scheduling — only publishing is gated)

### 5. Frontend: `PostReviewPanel.tsx` — Disable Publish Now for unapproved
The "Publish Now" button (line 830) currently has no `neel_approved` guard. Add `disabled={!post.neel_approved || post.status === "declined"}` so only approved posts show an active publish button.

### 6. Frontend: `schedulePost.ts` — Block declined on client side
Add a pre-check: if the post status is "declined", show a toast and return early.

## Files Changed

| File | Change |
|------|--------|
| DB migration | Add `declined_by` column |
| `src/pages/SocialMediaManager.tsx` | handleDecline sets `neel_approved: false, declined_by` |
| `supabase/functions/social-publish/index.ts` | Block declined posts; remove `force_publish` bypass |
| `supabase/functions/schedule-post/index.ts` | Block declined posts from scheduling |
| `src/components/social/PostReviewPanel.tsx` | Disable Publish Now when not approved or declined |
| `src/lib/schedulePost.ts` | Client-side declined guard |
| Redeploy `social-publish`, `schedule-post` | |

