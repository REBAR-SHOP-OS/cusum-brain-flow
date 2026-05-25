## Goal
Fix the actual LinkedIn publish failure end-to-end so LinkedIn cards stop going red for real reasons, not just display reasons.

## What I found
- The current LinkedIn failure is not only a UI issue; the backend is returning real token-expiry errors.
- Existing LinkedIn connections in the database are in `error` state with `Token expired, please reconnect`.
- The LinkedIn OAuth flow currently requests:
  - `openid profile email w_member_social w_organization_social r_organization_social`
- The flow does not request `offline_access`, which is required for reliable long-lived refresh behavior.
- In `social-publish`, LinkedIn team/company fallback can pick another teammate’s LinkedIn connection, but refresh attempts are still written against the original caller’s `user_id` instead of the actual token owner. That can make refresh fail or update the wrong row.

## Implementation plan
1. **Fix LinkedIn token ownership in publish flow**
   - Track which user actually owns the LinkedIn connection being used.
   - Use that owner consistently for refresh and for any post-refresh DB updates.
   - Apply this to both direct publish and teammate fallback paths.

2. **Fix LinkedIn OAuth scopes for durable refresh**
   - Update the LinkedIn connect flow to request `offline_access`.
   - Preserve current posting scopes for both personal and organization publishing.
   - Ensure future reconnects store refresh-capable tokens.

3. **Harden LinkedIn connection selection logic**
   - Prefer a healthy connected row first.
   - If the user’s row is expired/error but has refresh capability, refresh it before failing over.
   - If fallback uses a teammate connection, keep that ownership all the way through userinfo, org lookup, media upload, and post publish.

4. **Improve error accuracy for LinkedIn failures**
   - Return precise failure reasons from LinkedIn publish attempts instead of generic API errors where possible.
   - Keep page-level results intact so personal/company LinkedIn targets show the exact failing account/page.

5. **Repair existing broken LinkedIn connections path**
   - After code changes, the app should guide affected users to reconnect LinkedIn with the corrected scope set.
   - This is necessary because already-expired authorizations will not self-heal if they were granted without proper refresh capability.

6. **Validate the full flow**
   - Verify LinkedIn status check, reconnect, personal publish, and organization publish paths.
   - Confirm the calendar/detail panel reflects the backend result correctly after a retry.

## Technical details
- Files likely to change:
  - `supabase/functions/social-publish/index.ts`
  - `supabase/functions/linkedin-oauth/index.ts`
  - possibly the frontend integration/status UI if reconnect prompting needs tightening
- No database migration is required for this fix unless I find missing persisted metadata during implementation.

## Expected outcome
- LinkedIn publish stops failing بسبب refresh/ownership bugs.
- New LinkedIn connections are refresh-capable.
- Existing affected LinkedIn accounts can be reconnected once, then publish normally.
- Red LinkedIn cards remain only for real publish failures, with accurate reasons.