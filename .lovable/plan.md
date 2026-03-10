

# Fix: Social Post Scheduling Not Persisting

## Root Cause Analysis

After auditing the full flow, the code paths in `PostReviewPanel.tsx` and `SchedulePopover.tsx` correctly set `status: "scheduled"` and `qa_status: "scheduled"`. The DB trigger and CHECK constraint both allow these values. RLS is configured for the correct user emails.

**The most likely failure mode is silent RLS/auth failures.** The Supabase `.update().select().single()` pattern DOES throw when RLS blocks the update (returns 0 rows), but the error may not be surfacing clearly to the user. Additionally:

1. **`pending_approval` status fails CHECK constraint** — auto-generated posts insert with `status: "pending_approval"` but the DB CHECK only allows `['published', 'scheduled', 'draft', 'declined']`. Posts fall back to the default `'draft'`.

2. **No `console.log` around scheduling mutations** — impossible to diagnose silent failures.

3. **The `useSocialApprovals.approvePost` sets `status: "scheduled"` but does NOT set `qa_status`** — the trigger requires `qa_status IN ('approved', 'scheduled', 'published')` when status is `'scheduled'`, but `qa_status` remains `'needs_review'` → **trigger REJECTS the update**.

## Fix Plan

### 1. DB Migration: Add `pending_approval` to status CHECK constraint
Allow the auto-generate flow to properly set `pending_approval` status.

```sql
ALTER TABLE public.social_posts DROP CONSTRAINT social_posts_status_check;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_status_check 
  CHECK (status = ANY (ARRAY['published', 'scheduled', 'draft', 'declined', 'pending_approval', 'publishing', 'failed']));
```

### 2. `src/hooks/useSocialApprovals.ts` — Fix `approvePost` to set `qa_status`
Line 46-49: The approval mutation sets `status: "scheduled"` but forgets `qa_status`, causing the trigger to reject it.

```typescript
// Before (broken):
.update({ status: "scheduled" })

// After (fixed):
.update({ status: "scheduled", qa_status: "approved" })
```

### 3. `src/components/social/PostReviewPanel.tsx` — Add defensive logging
Around the schedule button's `updatePost.mutate` call (line 565), add `console.log` before and verify response after. This is already partially done with the verification query at line 577, but add pre-mutation logging.

### 4. `src/hooks/useSocialPosts.ts` — Add logging to `updatePost`
Add `console.log` of the payload and response in the mutation function so every update is traceable.

## Files Changed
1. **DB migration** — expand status CHECK constraint
2. **`src/hooks/useSocialApprovals.ts`** — add `qa_status: "approved"` to approvePost
3. **`src/hooks/useSocialPosts.ts`** — add logging to updatePost mutation
4. **`src/components/social/PostReviewPanel.tsx`** — add pre-mutation logging

## Expected Behavior After Fix
- Setting a date + clicking Schedule → post saved with `status='scheduled'`, `qa_status='scheduled'`
- Approving via Approvals panel → post saved with `status='scheduled'`, `qa_status='approved'`
- Cron job finds scheduled posts and publishes them
- Console logs show exact payload and DB response for every scheduling action

