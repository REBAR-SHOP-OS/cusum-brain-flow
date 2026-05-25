# Plan

## Goal
Fix the Instagram publish failure on `/social-media-manager` where Meta returns `Media ID is not available` during publish.

## What I found
- The current failure is **not primarily a reconnect/token problem**.
- Recent backend logs show Meta returning:
  - `code: 9007`
  - `error_subcode: 2207027`
  - `error_user_msg: The media is not ready for publishing, please wait for a moment`
- The affected posts are being created as **`REELS` containers**.
- Our current backend creates the container and then reaches `media_publish` **too early**.
- The current status polling path is also unreliable because Meta is returning a spurious `Authorization Error (100/33)` on the container status check, so the code falls through and tries publishing optimistically.

## Implementation
1. **Harden Instagram container readiness logic**
   - Update `publishToInstagram()` in both:
     - `supabase/functions/social-publish/index.ts`
     - `supabase/functions/social-cron-publish/index.ts`
   - Treat `9007 / 2207027` from `media_publish` as a **not-ready-yet** condition, not a final failure.
   - Add bounded retry/backoff around `media_publish` for reels/videos/stories.

2. **Use safer wait strategy for video/reel publishing**
   - Stop assuming a container is ready after the first ambiguous status response.
   - Keep status polling for video/reel media, but treat `100/33` as **inconclusive**, not “ready”.
   - Add a timed readiness window aligned with Meta guidance so publish only happens after enough processing time has passed.

3. **Unify manual and cron behavior**
   - Make both publish paths use the exact same retry and readiness behavior so manual publish and scheduled publish do not diverge.
   - Keep token resolution as-is unless logs show a true auth error.

4. **Reduce false multi-page failures**
   - Improve per-page error handling so one page that is still processing doesn’t instantly mark the whole Instagram batch as failed.
   - Keep per-page retries independent and report the real reason when the container never becomes ready.

5. **Add diagnostic logs and validate**
   - Add concise logs for:
     - container creation
     - readiness wait attempts
     - `media_publish` retry attempts
     - final Meta error codes/subcodes
   - Deploy the updated backend functions and verify from logs that reels now wait long enough before publish.

## Technical details
- **Files to change:**
  - `supabase/functions/social-publish/index.ts`
  - `supabase/functions/social-cron-publish/index.ts`
- **No database migration needed**
- **No frontend changes planned**
- Likely fix pattern:
  - create IG container
  - wait/poll conservatively for reels/videos
  - if `media_publish` returns `9007/2207027`, retry after backoff
  - only surface reconnect guidance for real auth errors such as token/permission failures

## Expected result
Publishing Instagram reels should stop failing with `Media ID is not available`, and the system should only ask for reconnect when there is a real permission/token issue.