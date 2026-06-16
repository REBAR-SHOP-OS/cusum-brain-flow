## Diagnosis

The scheduled Instagram story did **not** fail because of a code bug. I traced the publish path and inspected the token store:

- `user_meta_tokens` for Sattar (the publishing user) still has the healthy row created on **2026-05-25**:
  - `platform = 'instagram'`, 6 pages, 6 IG business accounts, `expires_at = 2026-07-24` (not locally expired).
- `metaTokenResolver.ts` correctly selects that row (filters by exact `platform='instagram'`, ignores the per-page rows).
- The previous run of `social-publish` returned Meta's verbatim error:
  > "The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons."
- The current run shortens that to "Instagram token expired or missing permissions" via `instagramPublish.ts`, but it is the same Meta-side revocation.

**Root cause:** Meta has invalidated the long-lived Page/IG access token on its side (password change or security event on the Facebook account that authorized the app). The token is still present and not expired in our DB, but Meta refuses every Graph API call made with it. No edge-function code change can resurrect a revoked token — Meta only re-issues one through a fresh OAuth consent.

## The actual fix (operational, ~1 minute)

Only you can do this — it requires Facebook login in the browser:

1. Open the app → **Integrations**.
2. Find **Facebook / Instagram** → **Disconnect**.
3. Click **Connect**, sign in to Facebook with the account that admins all 6 Pages.
4. On the consent screen, keep **all** Pages checked and grant every permission, especially:
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_metadata`
   - `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `business_management`
5. After the callback completes, retry publishing the failed story (or wait for the next cron tick).

The OAuth handler will overwrite the `platform='instagram'` and `platform='facebook'` rows with new long-lived tokens and a fresh `expires_at` (~60 days out). All 6 pages will start publishing again.

## Verification I will run after you reconnect

- Query `user_meta_tokens` and confirm the `platform='instagram'` row's `expires_at` has moved forward and `updated_at` is recent.
- Hit `social-publish` via `supabase--curl_edge_functions` against the same scheduled story id and confirm a 200 with returned IG `media_id` per page.
- Tail `supabase--edge_function_logs` for `social-publish` to confirm no `OAuthException` / code 190.

## Optional cleanup (does not block publishing)

While inspecting the table I noticed 12 stray rows written on 2026-06-15 with synthetic platforms like `facebook_page_<id>` / `instagram_page_<id>`, each with `ig_count=0` and no `expires_at`. They are not read by `resolveMetaToken` (which filters `platform IN ('facebook','instagram')` exactly), so they are dead data, not a bug source. If you want, after the reconnect succeeds I can:

- Delete those 12 orphan rows in a one-shot SQL cleanup, and
- Add a small uniqueness guard so future OAuth callbacks cannot create per-page rows again.

I will **not** touch them in this fix unless you ask — they are inert.

## Files that would change

**None for the immediate fix.** The fix lives entirely in the Integrations UI you already have.

If you approve the optional cleanup, the only changes would be:
- A single SQL migration that deletes orphan `user_meta_tokens` rows where `platform NOT IN ('facebook','instagram')` for the current workspace, and
- A `UNIQUE (user_id, platform)` constraint on `user_meta_tokens` (if not already enforced) to prevent recurrence.

## What I will not do

- I will not write code that "auto-refreshes" a revoked token. Meta does not allow that — only a fresh OAuth consent can replace a revoked long-lived token.
- I will not bypass the publish-time token validation. The current error is the correct, honest signal.
