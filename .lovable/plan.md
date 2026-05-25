## Audit findings

- The Integrations page calls `facebook-oauth` with `check-status` for both `facebook` and `instagram`.
- `check-status` currently marks the connection as expired using only the stored `expires_at` timestamp.
- The logged-in user has old `facebook` and `instagram` main token rows with `expires_at` in April, so the UI flips back to **Reconnect** even though newer team Meta tokens exist.
- `social-publish` also uses owner-first token lookup, but it only falls back to a teammate when the owner token row is missing, not when it is expired/invalid.
- Facebook and Instagram are treated as separate token records even though Meta OAuth should be handled as one combined connection for this app.

## Root cause

The instability is a code/state mismatch:

1. Reconnect may refresh one Meta side, while the other side can keep an old expired row.
2. Status checks trust stale local expiry instead of validating and normalizing the active Meta connection.
3. Publishing does not skip expired owner tokens before using team fallback.

## Implementation plan

### 1. Unify Meta OAuth refresh

Update `supabase/functions/facebook-oauth/index.ts` so one Facebook/Instagram reconnect refreshes both sides:

- Always request the full combined Meta permission set for Facebook Pages + Instagram publishing.
- During `exchange-code`, always discover:
  - Facebook Pages
  - linked Instagram Business accounts
  - granted permissions
- Upsert both main token rows:
  - `platform = 'facebook'`
  - `platform = 'instagram'`
- Upsert page token rows for both prefixes:
  - `facebook_page_<pageId>`
  - `instagram_page_<pageId>`
- Update both `integration_connections` rows together so Facebook and Instagram show the same healthy state.

### 2. Make status checks stable and truthful

Update `facebook-oauth` `check-status` to use a deterministic resolver:

- Prefer the current user’s token only if it is not locally expired and validates against Meta.
- If the current user’s token is expired/invalid, search same-company teammates for a valid Meta token.
- If a valid team token exists, return `connected` and identify it as team-backed instead of showing `Reconnect`.
- If no valid token exists, return `error` with a clear reconnect message.
- Update `integration_connections` from the result so the UI does not oscillate between database state and function state.

### 3. Harden publishing token selection

Update `supabase/functions/social-publish/index.ts` and the matching cron path in `supabase/functions/social-cron-publish/index.ts`:

- Select a Meta token with the same resolver logic instead of blindly using the owner row.
- Skip expired/invalid owner tokens and fall back to a valid same-company teammate token.
- Keep page matching strict; no fallback to wrong pages.
- Keep Neel approval and existing publish locks untouched.

### 4. Preserve security and tenant isolation

- Only fallback within the same `company_id`.
- Do not expose tokens to the frontend.
- Do not weaken approval gates or RLS.
- Do not store roles on user/profile tables.

### 5. Validate without posting anything

After implementation:

- Deploy only the changed backend functions.
- Call `facebook-oauth` `check-status` for `facebook` and `instagram`.
- Confirm both return stable `connected` when a valid same-company Meta token exists.
- Confirm stale current-user rows no longer force the UI into `Reconnect`.
- Check recent edge logs for remaining Meta auth failures.

## Files expected to change

- `supabase/functions/facebook-oauth/index.ts`
- `supabase/functions/social-publish/index.ts`
- `supabase/functions/social-cron-publish/index.ts`

No frontend UI redesign is planned; the fix is in the Meta auth/status/publishing logic.