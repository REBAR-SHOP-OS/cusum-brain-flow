## Goal
Make Facebook/Instagram publishing stay reliable after reconnect, so the app no longer shows connected status while Instagram publish still fails with token/permission errors.

## What I found
- The current status check can show Meta as connected, but the publish path still fails later during Instagram media polling.
- There is a concrete backend bug in `facebook-oauth/index.ts` under `refresh-accounts`: it overwrites the main `facebook` / `instagram` token rows with the first page token.
- A page token is not a safe replacement for the long-lived user token. That can make the connection look healthy enough for page discovery while failing during Instagram container polling/publishing.
- `social-publish` and `social-cron-publish` are also slightly inconsistent in how they poll Instagram media status, so the manual and cron publish paths can behave differently.

## Plan
1. Fix the Meta token source bug in `facebook-oauth`
- Update `refresh-accounts` so it never promotes a page token into the main `facebook` / `instagram` token rows.
- Preserve the real long-lived user token as the main Meta token.
- Restrict `refresh-accounts` to only refresh discovered pages / Instagram account mappings, not replace the primary auth token.

2. Harden Meta token resolution for publish
- Keep using the existing shared resolver, but make sure publish only uses:
  - main long-lived user token for discovery/refresh
  - page token only where Meta actually requires a page token
- Ensure Instagram publish uses the correct token consistently for container create, status polling, and publish.

3. Unify the Instagram publish path
- Make `social-cron-publish` follow the same safer Instagram polling/auth pattern already partially present in `social-publish`.
- Standardize error handling so token/permission failures are classified the same way in both paths.

4. Add defensive logging only where needed
- Add concise logs that reveal whether the function is using a main Meta token or page token, without exposing secrets.
- This will make future failures clearly distinguish code-path bugs from real expired permissions.

5. Validate end-to-end
- Re-check the Meta reconnect/status flow.
- Verify that reconnect no longer degrades back into a broken publish state because of `refresh-accounts`.
- Verify manual publish and cron publish use the same stable Instagram token behavior.

## Files to change
- `supabase/functions/facebook-oauth/index.ts`
- `supabase/functions/social-publish/index.ts`
- `supabase/functions/social-cron-publish/index.ts`

## Technical notes
- This is not just an operations issue.
- The screenshot error message is real, but there is also a backend state bug causing valid reconnects to become unstable again.
- The main risky line is the `refresh-accounts` flow that currently sets the main Meta token from `pageTokenRows[0].access_token`.
- I will keep tenant isolation and the existing approval/publish locks unchanged.