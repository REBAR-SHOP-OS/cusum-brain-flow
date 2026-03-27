

# Fix: Declined Posts Getting Published

## Root Cause

Two gaps in `supabase/functions/social-cron-publish/index.ts`:

### Gap 1: Fresh-status guard ignores "declined" (line 152)
The per-post guard before publishing only skips `published` and `publishing`:
```ts
if (freshPost?.status === "published" || freshPost?.status === "publishing") {
  continue;
}
```
A declined post passes through this check and gets published.

### Gap 2: Overdue auto-approve has no declined exclusion (line 68-75)
The overdue query finds `status = "scheduled" AND neel_approved = false`. If a post was rejected in the approval table but the `social_posts.status` was set back to `scheduled` (or never changed from it due to a race), it gets auto-approved and merged into `duePosts`.

## Fix

### `supabase/functions/social-cron-publish/index.ts`

**1. Add "declined" and "failed" to fresh-status guard (line 152):**
```ts
if (["published", "publishing", "declined", "failed"].includes(freshPost?.status)) {
  console.log(`[social-cron-publish] Skipping ${post.id} — status is ${freshPost.status}`);
  continue;
}
```

**2. Exclude declined posts from overdue auto-approve query (line 68-75):**
Add `.neq("status", "declined")` so declined posts are never auto-approved:
```ts
const { data: overduePosts } = await supabase
  .from("social_posts")
  .select("*")
  .eq("status", "scheduled")       // only scheduled
  .eq("neel_approved", false)
  .neq("status", "declined")       // safety: exclude declined
  .lt("scheduled_date", midnightCutoff.toISOString())
  .limit(20);
```

(The `.eq("status", "scheduled")` already excludes declined, but the explicit `.neq` is a safety net in case filter logic changes.)

**3. Add declined guard to stuck-posts fallback (line 99-105):**
Already filters `status = "draft"` so this is safe, but add a log comment for clarity.

## File Changed
- `supabase/functions/social-cron-publish/index.ts` — add declined/failed to skip guard + exclude from overdue query

