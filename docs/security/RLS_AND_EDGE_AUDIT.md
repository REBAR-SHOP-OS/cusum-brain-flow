# RLS and Edge security audit (living document)

## Principles

- The browser is untrusted: React routes and `AdminRoute` are UX only.
- **Postgres RLS** and **Edge `handleRequest` + JWT** enforce real access control.

## social_posts (audited)

- **Before:** `is_social_team()` used a **hardcoded email list** in SQL (`SECURITY DEFINER`). Same emails were duplicated in `AdminRoute` / `App.tsx`.
- **After (migration `20260402120000_*`):** `is_social_team()` delegates to `has_any_role(auth.uid(), ['admin','marketing'])`. Team members receive the `marketing` role (seeded for the former email list).

Policies remain: SELECT/INSERT/UPDATE/DELETE for authenticated users only when `is_social_team()` is true.

## user_roles

- Only **admins** can insert/update/delete roles (existing policies).
- Users can **read their own** rows.

## Edge Functions — shared stack

- [`supabase/functions/_shared/auth.ts`](../../supabase/functions/_shared/auth.ts): `requireAuth` validates JWT via `getClaims()` (local verification).
- [`supabase/functions/_shared/requestHandler.ts`](../../supabase/functions/_shared/requestHandler.ts): CORS, optional `internalOnly` (`x-internal-secret`), `requireRole` / `requireAnyRole`, company resolution.
- [`supabase/functions/_shared/structuredLog.ts`](../../supabase/functions/_shared/structuredLog.ts): JSON logs to stdout for aggregation.

## Critical functions — auth gates (post-change)

| Function | Auth | Role / notes |
|----------|------|----------------|
| `schedule-post` | Required JWT | `admin` or `marketing` |
| `social-publish` | Required JWT | `admin` or `marketing`; Neel-approval **bypass** remains `admin` **or** legacy emails `radin@` / `zahra@` (see function code) |
| `regenerate-post` | Required JWT | `admin` or `marketing` |
| `auto-generate-post` | Required JWT | `admin` or `marketing` |
| `social-cron-publish` | `internalOnly` + secret | No user JWT |
| `voice-engine-token` | Varies | Review separately if widening scope |

## Remaining work (manual / follow-up)

- Audit **all** tables with PII/finance for `USING (true)`-style policies.
- Migrate other **email allowlists** in Edge (e.g. `social-publish` historical bypass) fully to roles where business rules allow.
- Regenerate [`src/integrations/supabase/types.ts`](../../src/integrations/supabase/types.ts) after apply: `supabase gen types typescript`.
