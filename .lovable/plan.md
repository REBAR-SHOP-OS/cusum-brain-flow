
# Full Application Audit Report -- CUSUM (Rebar ERP)

## 1. Architecture Overview

| Layer | Technology | Count |
|-------|-----------|-------|
| Frontend | React 18 + Vite + Tailwind + TypeScript | 46 pages, ~35 component folders |
| Backend | Supabase (Lovable Cloud) | 90 tables, 32 DB functions, 62 edge functions |
| Auth | Supabase Auth (email + Google OAuth) | 12 registered users |
| Storage | Supabase Storage | 8 buckets (5 private, 3 public) |

---

## 2. Security Findings

### CRITICAL (5)

**S1. Admin PIN hardcoded in client-side source code**
- File: `src/pages/AdminPanel.tsx` line 27: `const ADMIN_PIN = "7671"`
- Risk: Anyone can view source code and bypass the PIN gate
- Fix: Move PIN validation to an edge function; never embed secrets in frontend code

**S2. All 62 edge functions have `verify_jwt = false`**
- File: `supabase/config.toml`
- Every single edge function disables JWT verification at the gateway level
- While some functions implement internal auth checks (using `requireAuth()` from `_shared/auth.ts`), this is inconsistent -- several functions (daily-summary, gmail-webhook, ringcentral-webhook, etc.) may be callable without any authentication
- Fix: Audit each function; enable `verify_jwt = true` for user-facing functions and keep `false` only for webhooks/cron endpoints that validate auth internally

**S3. `email_signatures` table has `ALL` policy with `qual: true`**
- Policy name: "Service role full access"
- This `ALL` policy with condition `true` allows any authenticated user to perform any operation on the table. The `for ALL` policy applies to SELECT, INSERT, UPDATE, and DELETE
- The per-user policies (read/update own) are redundant because the `ALL true` policy overrides them
- Fix: Remove the "Service role full access" policy; service role already bypasses RLS

**S4. Customer portal delivery query is unscoped**
- File: `src/hooks/useCustomerPortalData.ts` line 43-44
- The deliveries query does NOT filter by `customerId`: `.from("deliveries").select("*, delivery_stops(*)").order(...)`
- It fetches ALL deliveries. The RLS policy protects via a subquery, but this is wasteful and relies entirely on RLS correctness
- Fix: Add `.eq("customer_id", customerId)` or filter through delivery stops on the client side

**S5. Profiles `Deny anonymous access` policy is ineffective**
- Policy: `qual: false` on SELECT -- this denies ALL reads, but is overridden by the other permissive SELECT policies ("Company members can read", "Admins can read", "Users can read own")
- The "Deny" policy is a no-op because Postgres OR's permissive policies together
- To truly deny anonymous access, this should be a RESTRICTIVE policy (using `AS RESTRICTIVE`) or anonymous access should be blocked at the role level

### HIGH (3)

**S6. Admin profile delete lacks company_id scoping**
- Policy: "Admins can delete profiles" uses `qual: has_role(auth.uid(), 'admin')` WITHOUT `company_id` check
- An admin from Company A could delete profiles from Company B
- Same issue with "Admins can update any profile" -- no `company_id` filter
- Fix: Add `AND company_id = get_user_company_id(auth.uid())` to both policies

**S7. Admin insert on profiles lacks WITH CHECK for company_id**
- Policy: "Admins can insert profiles" has `qual: <nil>` (no constraint at all on INSERT)
- Any admin can insert profiles into any company
- Fix: Add `WITH CHECK (company_id = get_user_company_id(auth.uid()))`

**S8. `bad_jwt` error storm in production**
- Auth logs show continuous 403 errors every minute from `cusum-brain-flow.lovable.app` with "invalid claim: missing sub claim"
- This is likely the archive-odoo-files cron job (now being fixed) or another automated process sending the anon key as a Bearer token
- Impact: Noise in logs, wasted compute, potential rate limiting

### MEDIUM (4)

**S9. Tables with `qual: true` SELECT policies (low-sensitivity reference data)**
- `agents`, `clearance_evidence`, `comms_agent_pairing`, `comms_alerts`, `comms_config`, `custom_shape_schematics`, `estimation_validation_rules`, `rebar_sizes`, `rebar_standards`, `wwm_standards`
- 11 tables allow any authenticated user to read all rows
- Acceptable for reference/config tables (rebar_sizes, standards), but `clearance_evidence` and `comms_alerts` may contain operational data that should be company-scoped

**S10. CEO Portal (`/ceo`) has no role guard**
- Route: `<Route path="/ceo" element={<P><CEOPortal /></P>} />` -- uses `P` wrapper which includes `RoleGuard`
- BUT `RoleGuard` only restricts workshop-only and sales-only users. Any internal user with office/accounting/field role can access the CEO Portal
- Fix: Add explicit admin-only check in CEOPortal component

**S11. Communications table too broadly accessible**
- RLS policy "Users read all communications in company" grants all company members access to all communications including sensitive negotiations
- Consider restricting to participants or assigned users

**S12. Gmail tokens encryption status uncertain**
- `user_gmail_tokens` has `is_encrypted` field but it's unclear if all tokens are actually encrypted
- The `TOKEN_ENCRYPTION_KEY` secret exists, suggesting encryption is implemented, but should be verified

### LOW / INFO (3)

**S13. Time clock entries visible to all company members**
- All employees can see each other's clock-in/out times
- Consider restricting to own records + managers

**S14. Employees cannot view own payroll records**
- `payroll_daily_snapshot` and `payroll_weekly_summary` lack self-access policies
- Employees should be able to view their own pay data

**S15. Machine runs modifiable by all workshop staff**
- Any workshop user can modify any machine run record
- Consider restricting to assigned operators + supervisors

---

## 3. Routing and Access Control

| Route | Protection | Role Guard |
|-------|-----------|------------|
| `/admin/*` | ProtectedRoute + RoleGuard + PIN + isAdmin check | Correct |
| `/ceo` | ProtectedRoute + RoleGuard | Missing admin-only check |
| `/portal` | Auth check in component (no ProtectedRoute wrapper) | Manual -- works but inconsistent |
| `/office` | ProtectedRoute + standalone layout (no AppLayout/RoleGuard) | Missing RoleGuard |
| `/vizzy` | ProtectedRoute only (no AppLayout/RoleGuard) | By design (Siri shortcut) |
| `/accounting` | ProtectedRoute + RoleGuard | RoleGuard allows office roles through |
| All other protected | ProtectedRoute + AppLayout + RoleGuard | Correct |

**Office Portal gap**: `/office` route wraps in `ProtectedRoute` but NOT `AppLayout`, meaning `RoleGuard` is never applied. Any authenticated user can access it.

---

## 4. Edge Functions Audit

**Total**: 62 edge functions, ALL with `verify_jwt = false`

| Category | Functions | Auth Method |
|----------|----------|-------------|
| Uses `requireAuth()` | ai-agent, handle-command, vizzy-erp-action, generate-suggestions, etc. | Internal JWT check |
| Webhook receivers | gmail-webhook, ringcentral-webhook, facebook-data-deletion | Should validate webhook signatures |
| OAuth flows | google-oauth, ringcentral-oauth, quickbooks-oauth, facebook-oauth, linkedin-oauth, tiktok-oauth | No JWT needed (redirect flows) |
| Cron/automated | daily-summary, archive-odoo-files, comms-alerts, email-activity-report | Need service-role or API key auth |
| Unknown auth | Several functions not audited individually | Risk of unauthenticated access |

---

## 5. Database Health

| Metric | Value |
|--------|-------|
| Total tables | 90 |
| Tables with RLS | 90 (100%) |
| DB functions | 32 |
| Tables with `true` SELECT policies | 11 (mostly config/reference) |
| Cross-company policy gaps | 3 (profile delete, profile update, profile insert) |
| Auth users | 12 |
| Storage buckets | 8 (5 private, 3 public) |

---

## 6. Active Issues

| Issue | Status |
|-------|--------|
| Odoo migration stuck at 751/18,323 | Fix deployed, awaiting cron job update with service role key |
| `bad_jwt` log storm (~every minute) | Caused by cron job using anon key; will resolve with cron fix |
| MCP connector returning 405 | Client misconfiguration (GET vs POST); server working correctly |
| `daily-summary` function error | `REPORT_MAILBOXES is not defined` -- broken reference in function code |

---

## 7. Recommended Priority Actions

**Immediate (do now)**:
1. Remove hardcoded PIN from `AdminPanel.tsx`; validate via edge function or DB function
2. Fix cross-company profile RLS policies (S6, S7)
3. Remove `ALL true` policy from `email_signatures` table (S3)
4. Complete cron job auth fix to unblock Odoo migration

**Short-term (this week)**:
5. Add admin-only guard to CEO Portal and Office Portal routes
6. Scope customer portal delivery query
7. Fix `daily-summary` function's `REPORT_MAILBOXES` reference error
8. Audit edge functions that lack internal auth checks
9. Make the profiles "Deny anonymous" policy RESTRICTIVE or remove it

**Medium-term (this month)**:
10. Enable `verify_jwt = true` on user-facing edge functions
11. Restrict `clearance_evidence` and `comms_alerts` to company-scoped policies
12. Add self-access payroll policies for employees
13. Verify Gmail token encryption coverage
14. Add rate limiting and audit logging to customer portal

---

## 8. Technical Debt

- 62 edge functions is a large surface area; consider consolidating related functions
- `profiles_safe` view used in some places, direct `profiles` table in others -- inconsistent PII handling
- `useCustomerPortalData` fetches deliveries without customer filter (relies entirely on RLS)
- Multiple auth patterns: `requireAuth()`, `optionalAuth()`, manual `getUser()`, service-role token comparison
- `InboxManager.tsx` page exists but is redirected to `/inbox` -- dead code
