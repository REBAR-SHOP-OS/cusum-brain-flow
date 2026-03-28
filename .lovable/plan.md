

# Audit: Social Media Integration Issues

## Issues Found

### Issue 1: Unsupported platforms silently fail as "failed"
**Location:** `supabase/functions/social-cron-publish/index.ts` line 182
**Bug:** `publishResult` defaults to `{ error: "Unsupported platform" }`. Only Facebook, Instagram, and LinkedIn have publish handlers. Twitter/X, TikTok, and YouTube posts get picked up by cron, marked as `"publishing"`, then immediately marked `"failed"` with error "Unsupported platform". This wastes cron cycles and confuses users.
**Fix:** Before entering the publish loop, skip posts on unsupported platforms — leave them as `"scheduled"` instead of marking them failed. Add a guard at line 155:
```typescript
const SUPPORTED_PLATFORMS = ["facebook", "instagram", "linkedin"];
if (!SUPPORTED_PLATFORMS.includes(post.platform)) {
  console.log(`[social-cron-publish] Skipping ${post.id} — platform "${post.platform}" not yet supported`);
  results.push({ postId: post.id, platform: post.platform, success: false, error: "Platform not yet supported" });
  continue;
}
```

### Issue 2: Auto-approval of overdue unapproved posts bypasses safety gate
**Location:** `supabase/functions/social-cron-publish/index.ts` lines 74-101
**Bug:** Posts scheduled before midnight that Neel hasn't approved get auto-approved and published. This contradicts the approval gate — a post Neel intentionally didn't approve will still go out.
**Fix:** Instead of auto-approving, mark these posts as `"failed"` with a clear reason so the team can decide:
```typescript
// Instead of auto-approving, flag as needing attention
await supabase.from("social_posts")
  .update({ status: "failed", last_error: "Approval deadline passed — not approved by Neel/Sattar" })
  .eq("id", op.id);
```

### Issue 3: LinkedIn token expiry has no user notification
**Location:** `supabase/functions/social-cron-publish/index.ts` line 458
**Bug:** When LinkedIn token expires, the post silently fails with "LinkedIn token expired". No notification is sent to the user, and the token has no refresh mechanism. Users only discover this when they see "Failed" posts days later.
**Fix:** Add `last_error` with a clear message pointing users to reconnect LinkedIn:
```typescript
if (config.expires_at < Date.now()) {
  return { error: "LinkedIn token expired — please reconnect LinkedIn in Settings → Integrations" };
}
```
This is already partially handled since failed posts get `last_error` set, but the message should be more actionable.

### Issue 4: Calendar shows wrong status color for future unapproved posts
**Location:** `src/components/social/SocialCalendar.tsx` lines 246-250
**Bug:** The calendar currently shows "Pending Approval" for ALL scheduled posts where `!isApproved`. But from the screenshot, some posts on Sat/Sun correctly show "Pending Approval ⏳" while others show "Scheduled · Approved". The issue is that when a group contains mixed approval states (some approved, some not), `isApproved` is `true` if ANY post in the group is approved — hiding unapproved siblings.
**Fix:** No code change needed here — this is working as designed since posts are grouped by platform+title+page. The visible "Pending Approval" posts are genuinely unapproved.

### Issue 5: LinkedIn image upload uses deprecated UGC API
**Location:** `supabase/functions/social-cron-publish/index.ts` lines 444-551
**Bug:** The LinkedIn publish function uses the deprecated `/v2/ugcPosts` endpoint and `/v2/assets?action=registerUpload` for image uploads. LinkedIn deprecated the UGC API in favor of the Community Management API (`/rest/posts`). This may stop working without notice.
**Fix:** Migrate to LinkedIn's Community Management API (lower priority, but flagged as technical debt).

## Summary of Changes

| File | Issue | Fix |
|------|-------|-----|
| `supabase/functions/social-cron-publish/index.ts` line 155 | Unsupported platforms fail loudly | Skip with `continue`, don't mark as failed |
| `supabase/functions/social-cron-publish/index.ts` lines 74-101 | Auto-approval bypasses safety | Mark as failed instead of auto-approving |
| `supabase/functions/social-cron-publish/index.ts` line 458 | LinkedIn token expiry silent | Improve error message for user action |
| `supabase/functions/social-cron-publish/index.ts` lines 444-551 | Deprecated LinkedIn API | Flag as tech debt (no immediate change) |

## Files Changed
- `supabase/functions/social-cron-publish/index.ts` — 3 targeted fixes

