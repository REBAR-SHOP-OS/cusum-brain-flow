# LinkedIn publish error + Instagram scheduled post — root cause & fix

## What the data actually shows

I queried the DB and the cron/publish code. Two distinct problems, two different root causes.

### 1) LinkedIn — error is factually correct, can't be fixed by code alone

Both LinkedIn connections in `integration_connections`:

```
status         = error
refresh_token  = NULL
scope          = email, openid, profile, w_member_social
organization_ids = empty
expires_at     < now()
```

LinkedIn's authorization server silently dropped `offline_access`, `w_organization_social`, `r_organization_social` during the last OAuth round, because the LinkedIn **App** in the LinkedIn Developer Portal is not approved for:

- "Sign In with LinkedIn using OpenID Connect" product → grants `offline_access` (required for `refresh_token`)
- "Marketing Developer Platform" / "Community Management API" → grants `w_organization_social` + `r_organization_social` (required to publish to company pages and to discover them via `organizationAcls`)

Consequences baked into the data:
- No `refresh_token` → token expires in ~60 days and the server CANNOT auto-refresh, no matter what we change in code.
- No `organization_ids` → company-page publishing has nothing to target.
- Both tokens are already past `expires_at`, so today every publish attempt produces exactly the multi-reason error in the screenshot.

The error message you saw lists 4 reasons and every single one is true in the DB right now. We can't "fix" it from inside the app any more than we already do — the LinkedIn App itself must be approved for the missing products, then someone reconnects.

What I will improve in code so this doesn't keep biting silently:

1. **Token health cron (new)** `supabase/functions/linkedin-token-health/index.ts`
   - Runs daily.
   - For every `integration_connections` row where `integration_id='linkedin'` and `status='connected'` and `expires_at < now() + 7 days` and `refresh_token IS NOT NULL`, call LinkedIn refresh and store new token + `expires_at`.
   - For rows where token is already expired and there is no `refresh_token`, OR where `scope` is missing any of `offline_access / w_organization_social / r_organization_social`, set `status='error'` and write a precise `error_message` so the Integrations card shows "Reconnect required: LinkedIn App missing X product approval" instead of waiting until publish time.
   - Schedule in `supabase/config.toml`-equivalent cron config (re-use existing cron infra used by `social-cron-publish`).

2. **Block "Publish Now" earlier in the UI**
   - In `src/hooks/usePublishPost.ts`, when `linkedin-oauth check-status` returns `status='error'`, do NOT just toast — also surface a one-click "Reconnect LinkedIn" action that opens `linkedin-oauth get-auth-url` directly, so the operator doesn't bounce through Settings.

3. **Callback page improvement** (`src/pages/IntegrationCallback.tsx`)
   - When `status=error&integration=linkedin&message=...` arrives (the case where LinkedIn dropped scopes), render a dedicated panel listing the exact LinkedIn Developer Portal steps to request the missing products. Keep the technical message but add the human action list.

What you (the user) must still do once for this to actually work:

- In https://www.linkedin.com/developers/apps select the app, **Products** tab, request: "Sign In with LinkedIn using OpenID Connect", "Share on LinkedIn", and "Community Management API". The first two are auto-approved; Community Management API requires LinkedIn review (a few days).
- After the products show "Added", click **Reconnect LinkedIn** in Settings → Integrations. The callback will then receive the full scope set and write a `refresh_token` + `organization_ids`, and the recurring failures stop.

There is no code-only path that gets past this. I will not pretend otherwise.

### 2) Instagram "was scheduled but didn't publish"

The most recent scheduled IG post (`35fd450e-ff2c-4641-bbf3-5d408a5a32e7`, scheduled for 2026-05-28 19:00 UTC) has:

```
status         = scheduled
neel_approved  = false
```

`social-cron-publish` only picks up posts where `neel_approved = true` (Neel Approval Gate HARD rule, indexed in `mem://index.md`). I will NOT bypass that gate.

So the post did not publish because nobody approved it before the scheduled time. The system worked as designed; the UX did not warn loudly enough.

Code changes:

1. **Stronger "unapproved + scheduled" surfacing** in `src/components/social/SocialCalendar.tsx` and `PostReviewPanel`:
   - Add a small badge "Awaiting approval" on every scheduled card where `neel_approved=false`, instead of just a yellow tint.
   - On the calendar header, show a count like "3 scheduled today need approval" linking to the filter.

2. **Pre-flight nudge in `social-cron-publish`** (already partially there — overdue unapproved get marked failed at midnight): add one line so the post gets a clearer `last_error="Awaiting Neel/Sattar approval — scheduled time passed"` the moment it misses its slot, instead of waiting until the midnight sweep.

3. **Stale-lock false positives** (older IG failures like `ebb9687b...`, `a711f995...` saying "Publishing timed out — recovered from stale lock"):
   - Raise IG video/Reels stale-lock threshold from 10 min → 20 min in `_shared/publishLock.ts::recoverStaleLocks` for posts where `content_type='reel'` or media is `.mp4`.
   - Add a single automatic retry inside `social-cron-publish` if the lock was recovered AND the previous attempt produced a 200 OK creation ID before stalling (so we don't double-post).

## Files to touch

- New: `supabase/functions/linkedin-token-health/index.ts` + cron config entry.
- Edit: `supabase/functions/_shared/publishLock.ts` (per-content-type threshold + recover metadata).
- Edit: `supabase/functions/social-cron-publish/index.ts` (clearer last_error for unapproved overdue, one-shot retry on recovered lock).
- Edit: `src/hooks/usePublishPost.ts` (inline Reconnect action on LinkedIn error).
- Edit: `src/pages/IntegrationCallback.tsx` (LinkedIn scope-drop panel).
- Edit: `src/components/social/SocialCalendar.tsx`, `src/components/social/PostReviewPanel.tsx` ("Awaiting approval" badge).
- New: `tests/regression/social/linkedin-token-health.test.ts`, `tests/regression/social/awaiting-approval-badge.test.tsx`.

## Verification I will run after build

- `vitest` on the two new tests + existing social tests.
- `psql` re-check that `linkedin-token-health` (curled via `supabase--curl_edge_functions`) updates `status` + `error_message` for both rows in `integration_connections` to a precise message.
- Confirm `35fd450e...` shows the "Awaiting approval" badge in the calendar (preview).
- Confirm pressing **Publish Now** on a LinkedIn post with `status=error` opens the Reconnect flow inline.

## What this plan does NOT do

- Does NOT bypass `neel_approved` (HARD gate).
- Does NOT silently re-publish a post that may have already gone live (idempotency preserved via `publishing_lock_id`).
- Does NOT and cannot grant LinkedIn scopes the App was never approved for — that step is in the LinkedIn Developer Portal, not in our code.
