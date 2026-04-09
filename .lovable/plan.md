

# Add LinkedIn OAuth Token Auto-Refresh to Social Publishing

## Problem
When LinkedIn's access token expires (every 60 days), all LinkedIn publishing fails with "Token expired. Please reconnect." The `refresh_token` is already stored in the database during OAuth callback but is never used. Users must manually disconnect and reconnect LinkedIn every time.

## Root Cause
Two locations fail without attempting refresh:
1. **`publishToLinkedIn`** (social-publish, line 747): returns error `"LinkedIn token expired. Please reconnect."`
2. **`handleCheckStatus`** (linkedin-oauth, line 227-234): marks connection as error immediately

The refresh token IS stored in `integration_connections.config.refresh_token` (line 171 of linkedin-oauth) but never consumed.

## Changes

### File: `supabase/functions/social-publish/index.ts` (publishToLinkedIn function, ~line 694)

Add a `refreshLinkedInToken` helper and modify `publishToLinkedIn`:

1. **New helper** `refreshLinkedInToken(supabase, userId, config)`:
   - Uses stored `refresh_token` to call `https://www.linkedin.com/oauth/v2/accessToken` with `grant_type=refresh_token`
   - On success: updates `integration_connections.config` with new `access_token`, `expires_at`, and (if returned) new `refresh_token`
   - Returns new access token or null on failure

2. **Modify token expiry check** (line 747):
   - Instead of returning error immediately, call `refreshLinkedInToken`
   - If refresh succeeds, continue with new token
   - If refresh fails, THEN return the "please reconnect" error

3. **Add 401 retry**: After the `ugcPosts` API call (line 840), if response is 401:
   - Attempt token refresh
   - Retry the post with new token
   - If still fails, return error with reconnect guidance

### File: `supabase/functions/linkedin-oauth/index.ts` (handleCheckStatus, ~line 213)

1. **Auto-refresh on status check** (line 227): Instead of marking as error when `expires_at < Date.now()`:
   - Attempt refresh using stored `refresh_token`
   - If refresh succeeds, update DB and return `status: "connected"`
   - If no refresh token or refresh fails, THEN mark as error

### Secret Requirements
- `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are already configured (used in linkedin-oauth callback)
- The `social-publish` function needs access to these same secrets for the refresh call

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/social-publish/index.ts` | Add `refreshLinkedInToken` helper, auto-refresh on expiry + 401 retry |
| `supabase/functions/linkedin-oauth/index.ts` | Auto-refresh in `handleCheckStatus` instead of immediate error |

## Result
- LinkedIn tokens auto-refresh seamlessly — users never see "token expired"
- If refresh token itself is invalid (rare), user gets clear "please reconnect" message
- Existing publishing flow unchanged for non-expired tokens
- Status checks also trigger refresh, keeping connection green proactively

