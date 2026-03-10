

# Root Cause: Auto-Generate Auth is Broken + Phantom Posts

## Investigation Summary

After exhaustive DB and log analysis:

- **Database has 25 posts** (21 draft, 4 published). Zero scheduled, zero pending_approval.
- **No post was created or updated after March 6** — the posts visible in the UI screenshot (35 total, including "Unlock structural integrity") **do not exist in the database**.
- **Cron job runs every minute**, consistently finds 0 scheduled posts. The post was **never saved** as `scheduled` in the DB.
- The post "Unlock structural integrity with R..." is **not in the database at all**.

## Root Cause Chain

### 1. `auto-generate-post` Auth is Broken
The `verifyAuth` function uses `supabase.auth.getClaims(token)` — **this method does not exist** in the Supabase JS client. It silently fails and returns `null`, causing every auto-generate call to return **401 Unauthorized**. No new posts are created.

```typescript
// BROKEN (line 52):
const { data, error } = await supabase.auth.getClaims(token);
// Should be:
const { data: { user }, error } = await supabase.auth.getUser(token);
```

### 2. Scheduling a Non-Existent Post Fails Silently
Since the auto-generated posts were never inserted into the DB, when the user clicks "Schedule", `updatePost.mutate({ id: phantomId, ... })` tries to update a row that doesn't exist. The `.update().select().single()` returns a PGRST116 error (0 rows), which triggers `onError`. However, the success toast in the screenshot suggests the UI might be in an inconsistent state from a previous session.

## Fix Plan

### File 1: `supabase/functions/auto-generate-post/index.ts`
- Replace `supabase.auth.getClaims(token)` with `supabase.auth.getUser(token)` 
- Extract `user.id` instead of `data.claims.sub`
- Add error logging for auth failures

### File 2: `src/hooks/useAutoGenerate.ts`
- Add logging of the edge function response to catch silent failures
- Show post count in the success toast

### No other changes needed
- The scheduling code (PostReviewPanel, SchedulePopover) is already correct from our previous fixes
- The CHECK constraint and trigger fixes are already applied
- Once auto-generate actually creates posts in the DB, scheduling will work end-to-end

## Expected Result After Fix
1. "Auto-generate today" → edge function authenticates correctly → posts inserted with `status: 'pending_approval'`
2. User approves/schedules → `status: 'scheduled'`, `qa_status: 'scheduled'` saved in DB
3. Cron job finds the post → publishes it → `status: 'published'`

