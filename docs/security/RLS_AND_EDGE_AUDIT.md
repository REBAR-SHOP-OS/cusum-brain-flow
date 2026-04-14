# RLS and Edge security audit (living document)

## Principles

- The browser is untrusted: React routes and `AdminRoute` are UX only.
- **Postgres RLS** and **Edge `handleRequest` + JWT** enforce real access control.

## social_posts (audited ✅)

- **Before:** `is_social_team()` used a **hardcoded email list** in SQL (`SECURITY DEFINER`). Same emails were duplicated in `AdminRoute` / `App.tsx`.
- **After (migration `20260402120000_*`):** `is_social_team()` delegates to `has_any_role(auth.uid(), ['admin','marketing'])`. Team members receive the `marketing` role (seeded for the former email list).

Policies remain: SELECT/INSERT/UPDATE/DELETE for authenticated users only when `is_social_team()` is true.

## user_roles (audited ✅)

- Only **admins** can insert/update/delete roles (existing policies).
- Users can **read their own** rows.

## qb_company_config (audited ✅ — migration 20260414000000)

- **Before:** Single `USING (true)` policy — any authenticated user could read/write all companies' QB config.
- **After:** `service_role` retains full access. Authenticated users are restricted to `company_id = get_user_company_id(auth.uid())`.

## qb_reconciliation_issues (audited ✅ — migration 20260414000000)

- **Before:** Single `USING (true)` policy — cross-company finance reconciliation data was accessible to any logged-in user.
- **After:** `service_role` full access. Authenticated users SELECT their own company. Write operations (INSERT/UPDATE/DELETE) require `admin` or `accounting` role.

## leads / customers / lead_files — anon access removed (✅ — migration 20260414000000)

- **Before:** Explicit `TO anon USING (true)` SELECT policies on `leads`, `customers`, and `lead_files` exposed all contact/PII data to unauthenticated requests.
- **Justification for removal:** All public-facing pages (CustomerPortal, AcceptQuote, VendorPortal) reach these tables via service-role edge functions only, not direct anon PostgREST queries.
- **After:** Anon SELECT policies dropped. Authenticated access policies (company-scoped) remain in place from earlier migrations.

## Edge Functions — shared stack (audited ✅)

- [`supabase/functions/_shared/auth.ts`](../../supabase/functions/_shared/auth.ts): `requireAuth` validates JWT via `getClaims()` (local verification).
- [`supabase/functions/_shared/requestHandler.ts`](../../supabase/functions/_shared/requestHandler.ts): CORS, optional `internalOnly` (`x-internal-secret`), `requireRole` / `requireAnyRole`, company resolution.
- [`supabase/functions/_shared/structuredLog.ts`](../../supabase/functions/_shared/structuredLog.ts): JSON logs to stdout for aggregation.

## Critical functions — auth gates (post-change)

| Function | Auth | Role / notes |
|----------|------|----------------|
| `schedule-post` | Required JWT | `admin` or `marketing` |
| `social-publish` | Required JWT | `admin` or `marketing`; super-admin email fallback via `SUPER_ADMIN_EMAILS` (defined in `_shared/accessPolicies.ts`, applied in `_shared/roleCheck.ts`) |
| `regenerate-post` | Required JWT | `admin` or `marketing` |
| `auto-generate-post` | Required JWT | `admin` or `marketing` |
| `social-cron-publish` | `internalOnly` + secret | No user JWT |
| `voice-engine-token` | Varies | Review separately if widening scope |

## Remaining work

- **`SUPER_ADMIN_EMAILS` email bypass in `roleCheck.ts`:** `requireRole` / `requireAnyRole` still check `SUPER_ADMIN_EMAILS` before the role table. This is a controlled backstop for the three named super admins. Can be eliminated once those users are confirmed to have the `admin` role in `user_roles` in production.
- **`social-publish` super-admin fallback:** Uses `hasAnyRole(["admin","marketing"])` first; falls back to `SUPER_ADMIN_EMAILS`. Acceptable short-term; migrate fully once role seeding is confirmed.
- **Regenerate types:** Run `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts` after applying the new migration to keep TypeScript types in sync.
- **Broader `USING (true)` tables:** Remaining instances are either `service_role`-only (appropriate) or reference/config tables where read-only access by any authenticated user is intentional. Each has been reviewed in the table below.

## `USING (true)` policy inventory — reviewed

| Table | Policy type | Risk | Decision |
|---|---|---|---|
| `rebar_standards` | `authenticated` SELECT | ✅ Low — read-only engineering reference data, no PII | Keep |
| `wwm_standards` | `authenticated` SELECT | ✅ Low — read-only reference data | Keep |
| `estimation_validation_rules` | `authenticated` SELECT | ✅ Low — read-only config | Keep |
| `feature_flags` | `authenticated` SELECT | ✅ Low — UI feature switches, not sensitive | Keep |
| `llm_routing_policy` | `authenticated` SELECT | ✅ Low — AI routing config, not sensitive | Keep |
| `llm_provider_configs` | `authenticated` SELECT | ✅ Low — provider health status only | Keep |
| `ai_usage_log` | `authenticated` SELECT | ⚠️ Medium — token usage data; review if per-company scoping needed at scale | Monitor |
| `workspace_settings` | `authenticated` SELECT/UPDATE | ⚠️ Medium — scoped to single-tenant; add `company_id` filter if multi-tenant grows | Monitor |
| `qb_sync_locks` / `qb_api_failures` | `service_role` ALL | ✅ Low — internal system tables, service_role only | Keep |
| `qb_classes` / `qb_departments` / `qb_webhook_events` | `service_role` ALL | ✅ Low — internal QB sync tables | Keep |
| `vizzy_interactions` / `vizzy_journals` | `service_role` ALL | ✅ Low — AI agent system tables | Keep |
| `companies` | `authenticated` SELECT/UPDATE | ⚠️ Medium — any authenticated user can read/update any company; single-tenant deployment makes this acceptable today; revisit if hosting multiple tenants | Monitor |
| `scopes_of_work` / `entity_links` | `authenticated` SELECT/DELETE | ✅ Low — project reference data, no PII | Keep |
| `bank_connections` / `bank_transactions_live` | `service_role` ALL | ✅ Low — service_role only, accessed via Plaid edge function | Keep |
