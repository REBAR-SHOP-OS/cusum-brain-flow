
# Security Hardening Plan

This plan addresses all non-ignored security findings across the project. The changes are grouped into three categories: database policy fixes, edge function auth hardening, and informational dismissals.

---

## 1. Database Migration: Fix Overly Permissive RLS Policies

Replace `USING (true)` / `WITH CHECK (true)` policies on business tables with proper company-scoped or authenticated-only access. Tables without `company_id` (reference/lookup data) get restricted to authenticated read-only.

### Tables with `company_id` (scope to company):

| Table | Current Policy | New Policy |
|-------|---------------|------------|
| `automation_configs` | Service role full access (public, ALL, true) | Service role only (restrict to `service_role`) |
| `automation_runs` | Service role full access (public, ALL, true) | Service role only (restrict to `service_role`) |
| `customer_health_scores` | Service role full access (public, ALL, true) | Service role only (restrict to `service_role`) |
| `document_embeddings` | Service role can manage (public, ALL, true) | Service role only (restrict to `service_role`) |
| `estimation_learnings` | Service insert (public, INSERT, true) | Service role only (restrict to `service_role`) |
| `ingestion_progress` | Multiple service policies (public role, true) | Service role only + authenticated company-scoped read |
| `project_coordination_log` | Service insert/update (public, true) | Service role only (restrict to `service_role`) |
| `rc_presence` | Service manages presence (public, ALL, true) | Service role only (restrict to `service_role`) |
| `kb_articles` | Published articles readable by `anon` | Remove anon policy; authenticated company-scoped only |

### Tables without `company_id` (reference/lookup data):

| Table | Current Policy | New Policy |
|-------|---------------|------------|
| `rebar_standards` | Public read (anyone) | Authenticated read only |
| `wwm_standards` | Public read (anyone) | Authenticated read only |
| `estimation_validation_rules` | Public read (anyone) | Authenticated read only |
| `rebar_sizes` | Public read (anyone) | Authenticated read only |

### Extension fix:
- Move `vector` extension from `public` schema to `extensions` schema

---

## 2. Edge Function Auth Hardening

### Add authentication to `seo-ai-copilot`
Currently accepts any request with a `domain_id`. Will add `requireAuth()` and verify the user's company owns the requested domain.

### Sanitize error messages in edge functions
Update catch blocks in key functions to log detailed errors server-side but return generic messages to clients. Affected functions:
- `seo-ai-copilot`
- `app-help-chat` (public, but sanitize errors)

Note: `app-help-chat` and `website-chat` are intentionally public (help/widget endpoints). They will be marked as acceptable with a note.

---

## 3. Security Findings Management

After fixes, the following findings will be deleted (resolved):
- `overly_permissive_rls` - fixed by migration
- `kb_articles_public_exposure` - fixed by removing anon policy
- `automation_configs_business_logic_exposure` - fixed by restricting to service_role
- `ingestion_progress_data_exposure` - fixed by restricting to service_role
- `rebar_standards_pricing_data` - fixed by requiring auth
- `estimation_validation_rules_exposure` - fixed by requiring auth
- `wwm_standards_product_specs` - fixed by requiring auth
- `SUPA_extension_in_public` - fixed by moving vector extension
- `SUPA_rls_policy_always_true` - fixed by removing true policies
- `unauthenticated_edge_functions` - fixed (seo-ai-copilot gets auth; others marked acceptable)
- `verbose_edge_function_errors` - fixed by sanitizing error responses

---

## Technical Details

### SQL Migration (single migration)

```text
-- 1. Fix service-role policies: change role from 'public' to 'service_role'
--    for: automation_configs, automation_runs, customer_health_scores,
--         document_embeddings, estimation_learnings, ingestion_progress,
--         project_coordination_log, rc_presence

-- 2. Fix reference table policies: change role from 'public' to 'authenticated'
--    for: rebar_standards, wwm_standards, estimation_validation_rules, rebar_sizes

-- 3. Remove kb_articles anon policy

-- 4. Move vector extension to 'extensions' schema
```

### Edge Function Changes

**`seo-ai-copilot/index.ts`**: Add `requireAuth()` import and call. Verify user's company owns the domain_id before proceeding.

### Files Modified
- `supabase/functions/seo-ai-copilot/index.ts` (add auth + error sanitization)
- Database migration (RLS policy fixes + extension move)
