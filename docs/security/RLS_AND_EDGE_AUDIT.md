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

## Edge function auth audit (audited ✅ — April 2026)

Full scan of all 213 edge functions. Findings and resolutions below.

### Functions with legitimate public / optional auth (no changes needed)

| Function | Pattern | Justification |
|---|---|---|
| `quote-public-view` | No auth | Serves public quote URLs; reads only status + total; gated by quote_id |
| `validate-invite` | No auth | Pre-auth invite token validation; returns no PII beyond invite metadata |
| `consume-invite` | No auth | Pre-auth invite consumption; validates token expiry before acting |
| `facebook-data-deletion` | `authMode: "none"` | GDPR deletion callback from Facebook — must accept unauthenticated |
| `qb-webhook` | `authMode: "none"` | QuickBooks webhook — signed by QB HMAC, not user JWT |
| `wc-webhook` | `authMode: "none"` | WooCommerce webhook — signed by WC secret |
| `stripe-qb-webhook` | `authMode: "none"` | Stripe webhook — signed by Stripe, not user JWT |
| `gmail-webhook` | `authMode: "none"` | Gmail push — verified by topic token |
| `ringcentral-*` webhooks | `authMode: "optional"` | RingCentral HMAC-signed; service handles auth externally |
| `email-unsubscribe` | `authMode: "none"` | One-click unsubscribe via token link in email |
| `website-chat` / `website-chat-widget` | `authMode: "none"` | Public-facing customer support chat |
| `support-chat` | `authMode: "none"` | Public support chat widget |
| `elevenlabs-scribe-token` etc. | Various | Token vending machines — limited scope, reviewed separately |

### Findings fixed (this session)

#### HIGH: `elevenlabs-tts` — no auth → API cost abuse via public anon key (✅ Fixed)
- **Before:** `authMode: "none"` — anyone with the public anon key could call ElevenLabs TTS and drain credits.
- **After:** `authMode: "required"`. Frontend callers updated to pass `session.access_token` instead of the anon key.
- **Files:** `elevenlabs-tts/index.ts`, `MessageThread.tsx`, `ProVideoEditor.tsx`

#### HIGH: `assistant-action` — no auth → unauthenticated ERP data reads (✅ Fixed)
- **Before:** `authMode: "none"` — any HTTP client could retrieve order counts, machine lists, customer counts without logging in.
- **After:** `authMode: "required"`. `VizzyVoice.tsx` updated to send `session.access_token`.
- **Files:** `assistant-action/index.ts`, `VizzyVoice.tsx`

#### HIGH: `generate-invoice-pdf` — header presence check without JWT verification (✅ Fixed)
- **Before:** Only checked `if (!authHeader)` — any non-empty string passed. Function uploads HTML to storage bucket using service role.
- **After:** `requireAuth()` used to validate the JWT via `getClaims()` before proceeding.
- **Files:** `generate-invoice-pdf/index.ts`

#### HIGH: 14 cron/background functions with `internalOnly: false` (✅ Fixed)
- **Before:** All 14 had `authMode: "none"` + `internalOnly: false`. Cron and DB triggers already sent `x-internal-secret` but functions didn't check it — anyone could trigger them.
- **After:** `internalOnly: true` on all 14. The `handleRequest` middleware now enforces the shared secret.
- **Functions:** `comms-alerts`, `timeclock-alerts`, `email-automation-check`, `friday-ideas`, `check-escalations`, `social-cron-publish`, `vizzy-business-watchdog`, `notify-on-message`, `push-on-notify`, `notify-feedback-owner`, `send-push`, `pipeline-automation-engine`, `pipeline-lead-recycler`, `quote-expiry-watchdog`
- **Migration:** `20260414000001_schedule_missing_cron_jobs.sql` adds `pipeline-lead-recycler` and `quote-expiry-watchdog` to pg_cron with `x-internal-secret`.

#### MEDIUM: `vizzy-sms-reply` — no auth, can trigger SMS replies (✅ Fixed)
- **Before:** Raw `Deno.serve` with no auth; any caller could trigger AI SMS replies via RingCentral.
- **After:** Internal secret check added at entry point. `ringcentral-webhook` updated to send `x-internal-secret`.
- **Files:** `vizzy-sms-reply/index.ts`, `ringcentral-webhook/index.ts`

#### MEDIUM: `mcp-server` — API key accepted via URL query parameter (✅ Fixed)
- **Before:** `?api_key=...` accepted — key visible in server logs, browser history, and Referer headers.
- **After:** Query param support removed; only `x-api-key` header and `Authorization: Bearer` accepted.
- **Files:** `mcp-server/index.ts`

## Remaining work

- **`SUPER_ADMIN_EMAILS` email bypass in `roleCheck.ts`:** `requireRole` / `requireAnyRole` still check `SUPER_ADMIN_EMAILS` before the role table. This is a controlled backstop for the three named super admins. Can be eliminated once those users are confirmed to have the `admin` role in `user_roles` in production.
- **`social-publish` super-admin fallback:** Uses `hasAnyRole(["admin","marketing"])` first; falls back to `SUPER_ADMIN_EMAILS`. Acceptable short-term; migrate fully once role seeding is confirmed.
- **Regenerate types:** Run `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts` after applying the new migration to keep TypeScript types in sync.
- **`enhance-music-prompt` auth (ProVideoEditor.tsx line 267):** Uses anon key. Low risk (AI prompt only, no data written), deferred — same function context was updated for TTS.
- **`voice-engine-token`:** Required auth but no role enforcement. Review if restricted to specific roles.
- **`system-backup`:** `authMode: "optional"` — should be `internalOnly: true` if only cron-triggered; verify before changing.
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
