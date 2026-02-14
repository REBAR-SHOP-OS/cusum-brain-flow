

# Security Hardening Plan -- Addressing Passive Audit Findings

## Status: Phase 1-2 Complete, Phase 3-5 Partially Complete

## What Was Done

### Phase 1: Fix Overly Permissive RLS Policies ✅ COMPLETE

Migration applied:
- `dedup_rollback_log`: INSERT restricted to admin role
- `lead_events`: INSERT restricted to admin/office/sales roles
- `reconciliation_runs`: INSERT restricted to admin role

Remaining 4 linter warnings are all service_role policies (intentional, acceptable):
- `dedup_rollback_log` (service_role INSERT)
- `lead_events` (service_role INSERT)
- `reconciliation_runs` (service_role INSERT)
- `penny_collection_queue` (service_role ALL)

### Phase 2: Edge Function Auth Hardening ✅ COMPLETE

Full audit of all 52 edge functions:

| Category | Functions | Status |
|----------|-----------|--------|
| Webhooks/Cron | gmail-webhook, ringcentral-webhook, social-cron-publish, check-sla-breaches, comms-alerts, daily-summary, penny-auto-actions, facebook-data-deletion, email-unsubscribe | ✅ Unauthenticated by design |
| OAuth callbacks | google-oauth, quickbooks-oauth, facebook-oauth, linkedin-oauth, tiktok-oauth, ringcentral-oauth | ✅ Unauthenticated by design |
| User-facing | All 40+ user-facing functions | ✅ All verified to have requireAuth/verifyAuth/getClaims at entry |
| Service-to-service | summarize-call, ringcentral-recording, ringcentral-ai, ringcentral-video, ringcentral-sync, process-rfq-emails, google-vision-ocr, import-crm-data, diagnostic-logs | ✅ All verified to have auth |
| **mcp-server** | mcp-server | ✅ **FIXED** — Added MCP_API_KEY validation middleware |

### Phase 4: Upload Security Controls ✅ COMPLETE

Created `supabase/functions/_shared/upload-validation.ts` with:
- File extension allowlist (documents, drawings, images, archives)
- Size limit enforcement (50MB max)
- Content-type vs extension consistency check
- Magic byte signature validation for common file types

### Phase 5: Security Headers ✅ COMPLETE

Created `public/_headers` file with:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()`

### Phase 3: Tighten Data Access Policies — DEFERRED

Requires careful analysis of existing RLS policies and may break functionality. Recommended for next sprint:
- communications: restrict to office/admin/sales roles
- payroll tables: restrict to admin + accounting roles

## Out of Scope (External Systems)

- WordPress/WooCommerce security (www.rebar.shop)
- Odoo RBAC/record rules (www.crm.rebar.shop)
- DNS/TLS configuration
- Payment/PCI scope
