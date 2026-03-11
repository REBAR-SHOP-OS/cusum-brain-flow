

## Root-Cause Fix: Facebook Permission Verification

### Problem
Facebook rejects publishing with error `(#200) requires both pages_read_engagement and pages_manage_posts`. The OAuth flow requests these scopes, but never verifies they were actually granted. The connection shows "connected" even when Facebook declined the permissions (common in Development Mode apps or when App Review hasn't approved them).

### Fix — 3 layers of protection

#### 1. Verify permissions after OAuth exchange (`facebook-oauth/index.ts`)
After exchanging the code for a token, call `GET /me/permissions` to check which scopes were actually granted. Store the result. If critical publish permissions are missing, mark the connection with a warning and return a clear message to the user.

```text
OAuth flow today:
  code → token → save → "connected" ✅

OAuth flow after fix:
  code → token → GET /me/permissions → check granted scopes
    → all granted: save as "connected" + publish_ready=true ✅
    → missing scopes: save as "connected" + publish_ready=false ⚠️
      → return warning message to user
```

#### 2. Pre-flight permission check before publishing (`social-publish/index.ts` + `social-cron-publish/index.ts`)
Before calling the Facebook Graph API to post, verify the page token actually has publish access by calling `GET /{page_id}?fields=id,name&access_token={token}`. If it returns a permission error, fail fast with a clear message instead of attempting to publish.

#### 3. UI warning on scheduling (`PostReviewPanel.tsx` or equivalent)
When a user tries to schedule a Facebook post, check if the connection has `publish_ready` status. If not, show a warning banner: "Facebook permissions incomplete — reconnect to grant publishing access."

### Files to change
1. **`supabase/functions/facebook-oauth/index.ts`** — Add `GET /me/permissions` call after token exchange; store `publish_ready` flag in `user_meta_tokens` or `integration_connections.config`; return warning if scopes missing
2. **`supabase/functions/social-publish/index.ts`** — Add pre-flight token validation before calling Graph API
3. **`supabase/functions/social-cron-publish/index.ts`** — Same pre-flight check for scheduled posts
4. **`src/components/social/PostReviewPanel.tsx`** — Show permission warning banner when Facebook connection lacks publish permissions

