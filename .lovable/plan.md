

# Fix: Facebook Publishing Permission Error (#200)

## Root Cause Analysis

The error `(#200) pages_manage_posts are not available` occurs because **the Facebook App has not been approved for this permission through Meta App Review**. The pre-flight check in the code only verifies the token can read page info (`?fields=id,name`), which passes — but the actual publish call to `/{pageId}/feed` or `/{pageId}/photos` requires `pages_manage_posts`, which fails.

This is primarily an **external configuration issue** in the Meta Developer Console, not a code bug. However, the code can be improved to detect this earlier and provide actionable feedback.

## Required External Action (Meta Developer Console)

The Facebook App must have `pages_manage_posts` approved:
- If App is in **Development mode**: Only Admins/Developers/Testers of the app can use this permission. Add `zahra@rebar.shop`'s Facebook account as a Tester in App Roles.
- If App is in **Live mode**: Submit `pages_manage_posts` for App Review approval.

## Code Improvements

### File: `supabase/functions/social-publish/index.ts`

**Enhance the pre-flight check** (around line 224-237) to verify `pages_manage_posts` permission before attempting to publish:

1. After refreshing the page token, call `GET /{pageId}/feed?limit=1` as a read test — this uses `pages_read_engagement` and confirms the token works.
2. Then call `GET /me/permissions?access_token={token}` to check if `pages_manage_posts` is actually granted.
3. If not granted, return a clear error: "Facebook App does not have `pages_manage_posts` permission. Add this user as a Tester in Meta Developer Console, or submit the permission for App Review."

### File: `supabase/functions/social-cron-publish/index.ts`

Apply the same permission pre-check for the cron publisher (around line 231-238).

### Summary
- Add explicit permission verification before publish attempts
- Surface a clear, actionable error message distinguishing between "token invalid" and "permission not approved"
- The actual fix requires action in the Meta Developer Console (adding the user as Tester or submitting for App Review)

