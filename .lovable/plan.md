

# Security Hardening Plan -- Addressing Passive Audit Findings

## Scope

This plan addresses the findings from the passive security audit that are **actionable within the Rebar ERP codebase** (Lovable Cloud). Items related to external properties (www.rebar.shop WordPress, www.crm.rebar.shop Odoo) are outside this codebase and noted as out-of-scope.

## Current State (From Automated Scans)

- **4 RLS "always true" warnings**: `dedup_rollback_log`, `lead_events`, `reconciliation_runs` (INSERT with `WITH CHECK (true)` for public role), and `penny_collection_queue` (ALL for service_role -- acceptable)
- **All 52 edge functions** have `verify_jwt = false` in config.toml. Many use `requireAuth()` internally, but the gateway-level check is disabled everywhere.
- **12 error-level findings** from security scanners about data exposure (contacts, profiles, orders, quotes, salaries, financial data, communications, leads)
- **8 warn-level findings** about overly broad access within roles

## What This Plan Fixes

### Phase 1: Fix Overly Permissive RLS Policies (P0)

The three new tables created in the last migration have INSERT policies allowing any authenticated user to write:

**Migration to fix:**
- `dedup_rollback_log`: Change INSERT policy from `WITH CHECK (true)` to `WITH CHECK (has_role(auth.uid(), 'admin'))`
- `lead_events`: Change INSERT policy from `WITH CHECK (true)` to `WITH CHECK (has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]))`
- `reconciliation_runs`: Change INSERT policy from `WITH CHECK (true)` to `WITH CHECK (has_role(auth.uid(), 'admin'))`

These tables are written to by edge functions using service_role, so the restrictive policies won't break functionality -- service_role bypasses RLS.

### Phase 2: Edge Function Auth Hardening (P0)

Currently all 52 functions have `verify_jwt = false`. This is a deliberate pattern because:
- Many functions use internal `requireAuth()` for user-facing endpoints
- Some are webhooks/cron jobs that legitimately need unauthenticated access (e.g., `gmail-webhook`, `ringcentral-webhook`, `social-cron-publish`)
- Some are OAuth callback handlers (e.g., `google-oauth`, `quickbooks-oauth`)

**Action**: Audit each edge function and classify:

| Category | Functions | Action |
|----------|-----------|--------|
| Webhooks/Cron (must stay unauthenticated) | gmail-webhook, ringcentral-webhook, social-cron-publish, check-sla-breaches, comms-alerts, daily-summary, penny-auto-actions, facebook-data-deletion, email-unsubscribe | Keep `verify_jwt = false`; verify internal auth/secret checks |
| OAuth callbacks (must stay unauthenticated) | google-oauth, quickbooks-oauth, facebook-oauth, linkedin-oauth, tiktok-oauth, ringcentral-oauth | Keep `verify_jwt = false` |
| User-facing (already use requireAuth internally) | ai-agent, gmail-send, gmail-sync, gmail-delete, draft-email, pipeline-ai, manage-machine, log-machine-run, shape-vision, extract-manifest, manage-extract, manage-inventory, smart-dispatch, translate-message, generate-video, generate-image, social-publish, auto-generate-post, social-intelligence, face-recognize, payroll-engine, meeting-live-notes, summarize-meeting, transcribe-translate, vizzy-photo-analyze, vizzy-erp-action, email-activity-report, relay-pipeline, generate-suggestions, handle-command, prospect-leads, email-campaign-generate, email-campaign-send, odoo-crm-sync, odoo-reconciliation-report, archive-odoo-files, relink-orphan-invoices, qb-sync-engine, qb-audit, penny-execute-action, email-campaign-send | Verify each has `requireAuth()` at top; add if missing |
| Service-to-service (internal calls) | summarize-call, ringcentral-recording, ringcentral-ai, ringcentral-video, ringcentral-sync, process-rfq-emails, pdf-to-images, google-vision-ocr, import-crm-data, diagnostic-logs, mcp-server, elevenlabs-conversation-token, elevenlabs-scribe-token, elevenlabs-transcribe, odoo-reconciliation-report | Add shared secret validation or `requireAuth()` |

**Concrete changes**: For functions that handle sensitive data but lack auth checks, add `requireAuth()` calls at the entry point. This is the highest-impact security fix available.

### Phase 3: Tighten Data Access Policies (P1)

The security scanner flagged several tables with broad access. Most already have role-based RLS but the scanner identifies the *breadth* of role access as a risk. Actionable tightening:

- **communications**: Currently all company members can read. Add a policy restricting to users linked via `assigned_to` or `contact_id` ownership, or with office/admin/sales role.
- **employee_salaries**: Verify admin-only SELECT policy is enforced (audit trigger already exists).
- **payroll tables**: Tighten to admin + accounting roles only (currently any company member).

### Phase 4: Upload Security Controls (P1)

The audit highlights file upload surfaces. In the Rebar ERP codebase:

- Storage buckets for sensitive data (estimation-files, clearance-photos, shape-schematics) are already private with RLS.
- **Add file validation** in edge functions that handle uploads: check file extension against allowlist, enforce size limits, and validate content-type header matches actual file signature.
- Relevant functions: `extract-manifest`, `archive-odoo-files`, `shape-vision`, `face-recognize`.

### Phase 5: Security Headers (P1)

Add security headers to the Vite build output. Since this is a SPA served by Lovable's CDN, some headers may need to be set at the platform level. What we can control:

- Add a `_headers` file or configure headers in `vite.config.ts` dev server for: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- Edge functions already set CORS headers; verify `Content-Type: application/json` is set on all responses (it is, via the `json()` helper in `_shared/auth.ts`)

## Out of Scope (External Systems)

These items from the audit require action outside this codebase:
- WordPress/WooCommerce security (www.rebar.shop) -- managed separately
- Odoo RBAC/record rules (www.crm.rebar.shop) -- managed in Odoo admin
- DNS/TLS configuration -- managed at DNS/hosting provider
- Odoo social login OAuth configuration -- managed in Odoo settings
- Payment/PCI scope -- managed by payment processor

## Files to Modify

- Database migration (new): Fix 3 overly permissive RLS policies
- `supabase/functions/` (multiple): Add `requireAuth()` to unprotected user-facing functions
- `src/components/admin/AdminPanel.tsx` or security dashboard: Add security status widget showing suppression SLA, auth audit stats

## Validation Checks

- Linter re-run shows 0 "RLS Policy Always True" warnings (excluding the intentional service_role one on penny_collection_queue)
- All user-facing edge functions return 401 when called without Authorization header
- Webhook functions continue to work without auth (tested via curl)
- No regression in existing functionality

