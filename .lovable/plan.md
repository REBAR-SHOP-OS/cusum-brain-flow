

# Fix: Prevent Duplicate Publishing via Stale Lock Recovery

## Root Cause

The duplicate publish happens through this exact sequence:

```text
1. Manual "Publish Now" → acquirePublishLock → status = "publishing"
2. Edge function times out (video polling takes too long for 5 pages)
3. Post stays in "publishing" for >10 minutes
4. Cron runs → recoverStaleLocks() resets post to "scheduled"  ← THE BUG
5. Same cron run queries scheduled posts → finds this post → publishes AGAIN
6. Result: video posted TWICE to Instagram
```

The critical flaw is in `supabase/functions/_shared/publishLock.ts` — `recoverStaleLocks()` resets stale posts to `"scheduled"`, which makes them eligible for immediate re-publishing by the cron job.

## Fix

### File: `supabase/functions/_shared/publishLock.ts` — `recoverStaleLocks()`

Change the recovery status from `"scheduled"` to `"failed"` with an error message. This prevents automatic re-publishing and requires manual review.

```typescript
// BEFORE (dangerous):
status: "scheduled"

// AFTER (safe):
status: "failed",
last_error: "Publishing timed out — recovered from stale lock. Review before retrying.",
qa_status: "needs_review"
```

Apply this change to both update calls in `recoverStaleLocks()` (the main stale check and the legacy fallback).

### File: `supabase/functions/social-cron-publish/index.ts`

Add a safety guard: after `recoverStaleLocks()` runs, the recovered post IDs should be excluded from the subsequent scheduled posts query. This is a defense-in-depth measure in case the status update hasn't propagated.

```typescript
// After recoverStaleLocks:
const recoveredSet = new Set(recovered);

// When processing duePosts, skip any that were just recovered:
const safePosts = (duePosts || []).filter(p => !recoveredSet.has(p.id));
```

### Immediate fix for post `21b929c0`

This post is currently stuck in `status=publishing` with a stale lock. It will be recovered to "failed" on the next cron run after deployment.

## Impact
- 2 files changed (`publishLock.ts`, `social-cron-publish/index.ts`)
- Stale locks now recover to "failed" instead of "scheduled" — no automatic re-publishing
- Defense-in-depth: cron excludes just-recovered posts from its publish batch
- No database schema changes
- No frontend changes

