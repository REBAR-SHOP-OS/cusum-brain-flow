

## Fix: Auto-Publish Unapproved Posts After Midnight Deadline

### Problem

The cron publisher (`social-cron-publish`) only publishes posts where `neel_approved = true`. If Neel forgets to approve a scheduled post, it stays stuck forever. The business rule is: **if a post's scheduled date has passed midnight and Neel hasn't approved it, auto-publish it anyway**.

### Root Cause

Two gates block unapproved posts:
1. `social-cron-publish/index.ts` line 72: `.eq("neel_approved", true)` — skips unapproved posts entirely
2. `social-publish/index.ts` line 139: hard gate that returns 403 if `!neel_approved`

Both need a deadline-based bypass.

### Fix (2 files, minimal)

**Patch 1: `supabase/functions/social-cron-publish/index.ts`**

After the existing query for approved posts (line 68-75), add a second query for **overdue unapproved posts**:

```typescript
// Auto-publish overdue unapproved posts (deadline: midnight of scheduled day)
const midnightCutoff = new Date();
midnightCutoff.setUTCHours(0, 0, 0, 0); // start of today UTC

const { data: overduePosts } = await supabase
  .from("social_posts")
  .select("*")
  .eq("status", "scheduled")
  .eq("neel_approved", false)
  .lt("scheduled_date", midnightCutoff.toISOString())  // scheduled before today
  .order("scheduled_date", { ascending: true })
  .limit(20);
```

If overdue posts are found:
- Auto-set `neel_approved = true` on each (so it passes the publish gate)
- Merge them into the `duePosts` array for normal publishing
- Log clearly: `[social-cron-publish] Auto-approving overdue post {id} — Neel deadline passed`

Also update the second query (line 103-110) to include the same pattern.

**Patch 2: `supabase/functions/social-publish/index.ts`**

No change needed — the cron function sets `neel_approved = true` before publishing, so the hard gate in `social-publish` is not hit. Manual publish still requires approval (correct behavior).

### Logic Summary

```text
Cron runs → finds scheduled posts where:
  1. neel_approved = true AND scheduled_date <= now  (existing)
  2. neel_approved = false AND scheduled_date < midnight today  (NEW)
     → auto-approve these, then publish normally
```

### Files Changed

| File | Change | Category | Rollback |
|---|---|---|---|
| `supabase/functions/social-cron-publish/index.ts` | Add overdue unapproved post query + auto-approve | Safe additive | Remove the new query block |

### What Remains Unchanged
- Manual publish still requires Neel approval (hard gate in `social-publish`)
- Same-day scheduled posts still wait for approval until midnight
- All existing approved-post publishing logic untouched
- No route, schema, or UI changes

### Regression Risk
Low — only adds a new query path in the cron function. Existing approved-post flow is completely untouched.

