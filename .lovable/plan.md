

## Add Neel Approval Gate for Publishing

### Summary
Add a `neel_approved` boolean column to `social_posts`. No post can be published (neither via "Publish Now" nor via the cron job) unless `neel_approved = true`. Only `neel@rebar.shop` can toggle this approval. A visible approval button appears above the Schedule button in the review panel.

### Database Migration
Add column to `social_posts`:
```sql
ALTER TABLE public.social_posts ADD COLUMN neel_approved boolean NOT NULL DEFAULT false;
```

### Changes

**1. `src/components/social/PostReviewPanel.tsx`**
- Fetch current user email on mount (via `supabase.auth.getUser()`)
- Above the Schedule button, add a "Neel Approval" button:
  - If `neel_approved = true`: show green checkmark "Approved by Neel"
  - If `neel_approved = false` and current user is `neel@rebar.shop`: show clickable "Approve" button that sets `neel_approved = true` on the post
  - If `neel_approved = false` and current user is NOT neel: show disabled/grey "Awaiting Neel's Approval" label
- **Publish Now button**: Add guard — if `neel_approved !== true`, show toast "This post requires Neel's approval before publishing" and return
- **Schedule button**: No change needed (scheduling is allowed without approval; publishing is blocked)

**2. `supabase/functions/social-cron-publish/index.ts`**
- Add `.eq("neel_approved", true)` to the query on line 33, so the cron ONLY publishes posts that have Neel's approval
- Posts that are scheduled but not approved by Neel will simply wait until approved

**3. `src/hooks/useSocialPosts.ts`**
- Add `neel_approved: boolean` to the `SocialPost` interface

### Flow
1. radin/zahra create & schedule a post → status becomes `scheduled`, `neel_approved` remains `false`
2. Cron runs but skips the post (no `neel_approved`)
3. neel@rebar.shop opens the post, clicks "Approve" → `neel_approved = true`
4. Next cron run picks it up and publishes it
5. "Publish Now" also checks `neel_approved` before proceeding

