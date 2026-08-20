# Security incident response — API keys and sessions

## If a Supabase key may be exposed

1. **Rotate immediately** in Supabase Dashboard: Project Settings → API → roll **anon** and/or **service_role** as appropriate.
2. **Service role:** treat as full database access — rotate first if there is any chance it leaked (logs, client bundle, public repo).
3. **Anon key:** rotate if embedded in a leaked build; update all deployed env vars (`VITE_SUPABASE_PUBLISHABLE_KEY` / hosting secrets).
4. **Revoke sessions:** Auth → Users → sign out all users, or use admin API to invalidate refresh tokens if available on your plan.
5. **Review RLS:** confirm no policy relied on obscurity; service role bypasses RLS — never ship service key to the browser.

## If an OAuth token (Meta, RingCentral, QuickBooks, etc.) is exposed

1. Revoke in the provider’s developer console.
2. Re-connect integration from Integrations UI after rotation.
3. Check `user_meta_tokens` / integration tables for suspicious `updated_at` activity (forensics).

## Logging

- Edge: JSON lines from `structuredLog` / `createLogger` — filter by `level=error` and `status` for auth failures.
- Supabase: enable Auth and Postgres logs in Dashboard where the plan allows.

## Contacts

- Document your internal on-call and who can access Supabase project settings.
