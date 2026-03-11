

## Investigation Results & Fix Plan

### Why Facebook Posts Failed
The cron job logs from 16:45 show: **"6 published, 6 failed"** -- all 6 Instagram posts succeeded, all 6 Facebook posts failed. This is a **Facebook API error** (likely an expired or invalid page access token). The Facebook token needs to be refreshed via your Integrations settings.

### Critical Security Issue Found
The cron ran at 16:45 and published 6 Instagram posts **without Neel's approval** (`neel_approved: false` on all of them). This happened because the deployment hadn't taken effect yet. The current deployed code now correctly filters by `neel_approved = true` on line 34, confirmed by the 16:50 run returning 0 posts.

However, there are still **two gaps** where the `neel_approved` guard is missing:

### Gap 1: Stuck Posts Fallback in Cron (lines 65-71)
The re-fetch query for "stuck posts" does NOT include `.eq("neel_approved", true)`, which means promoted stuck posts could bypass Neel's approval.

### Gap 2: Manual `social-publish` Edge Function
The `social-publish` function (used by "Publish Now" button) does NOT check `neel_approved` server-side. The frontend guard exists but can be bypassed.

### Changes

**1. `supabase/functions/social-cron-publish/index.ts`** (line 68)
- Add `.eq("neel_approved", true)` to the stuck-posts re-fetch query

**2. `supabase/functions/social-publish/index.ts`** (after line 77)
- Add server-side guard: fetch the post's `neel_approved` field and reject with 403 if `false`

```typescript
// After the duplicate check, add:
if (post_id) {
  const { data: postCheck } = await supabaseAdmin
    .from("social_posts")
    .select("neel_approved")
    .eq("id", post_id)
    .single();
  if (!postCheck?.neel_approved) {
    return json({ error: "This post requires Neel's approval before publishing." }, 403);
  }
}
```

### Facebook Token Issue
The Facebook publish failures are due to a token/permission problem on the Facebook API side. After the code fixes are deployed, you will need to **re-authenticate your Facebook connection** in Integrations to refresh the page access tokens, then re-schedule the failed posts for a future time.

