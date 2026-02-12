

# ERP Audit Report — Rebar.Shop (2026-02-12)

## Executive Summary

The Rebar ERP (CUSUM) runs on Lovable Cloud with a full backend stack. This audit fills the evidence gaps from your initial assessment across all 8 control areas.

---

## 1. INVENTORY (AU-2 / Asset Management)

| Item | Evidence |
|------|----------|
| Total public tables | **87** |
| RLS enabled | **All tables** (0 tables with RLS disabled) |
| Largest table | `lead_activities` — 43,954 rows, 38 MB |
| Total DB size (top 20) | ~82 MB across top 20 tables |
| Edge functions deployed | **57** functions |
| Storage buckets | **8** (4 public, 4 private) |
| Active integrations | **10** connections (Facebook, Instagram x2, Gmail x2, Google Calendar, Drive, YouTube, Analytics) |

### Top Tables by Size
| Table | Rows | Size |
|-------|------|------|
| lead_activities | 43,954 | 38 MB |
| chat_messages | 139 | 18 MB |
| accounting_mirror | 1,916 | 7 MB |
| lead_files | 16,588 | 6 MB |
| leads | 2,712 | 3.5 MB |
| communications | 758 | 3.2 MB |
| quotes | 2,586 | 2 MB |
| customers | 2,733 | 936 kB |
| contacts | 2,679 | 792 kB |

---

## 2. RBAC / ACCESS CONTROL (AC-6)

| Role | Count | Users |
|------|-------|-------|
| admin | 4 | Radin, Sattar, Vicky, (1 unmatched) |
| accounting | 1 | Vicky Anderson |
| sales | 1 | Behnam Rajabifar |
| office | 1 | (implied) |
| workshop | 3 | Kourosh Zand, AI Assistant, (1 unmatched) |

| Check | Status |
|-------|--------|
| Roles in separate table (`user_roles`) | YES |
| `has_role()` security definer function | YES |
| `has_any_role()` multi-role check | YES |
| Profile company_id protection trigger | YES |
| Profile user_id protection trigger | YES |
| Super-admin hardcoded check | `sattar@rebar.shop` in edge functions |
| PIN-protected admin access | YES (7671) |
| Kourosh blocked from office roles | Enforced in code |
| Total profiles | 12 (9 linked to auth, 3 orphaned) |

### Findings
- **3 orphaned profiles** (no `user_id` link) — should be investigated
- Super-admin check is hardcoded email, not role-based — acceptable for single-owner but noted

---

## 3. AUDIT LOGS (AU-2)

| Log Store | Records | Status |
|-----------|---------|--------|
| `events` | 364 | Active (Feb 7-11) |
| `command_log` | 0 | Schema exists, no entries |
| `contact_access_log` | 0 | Schema exists, triggers wired |
| `financial_access_log` | 0 | Schema exists, triggers wired |
| `payroll_audit_log` | 0 | Schema exists, used in code |

### Findings
- **CONCERN**: `contact_access_log`, `financial_access_log`, and `payroll_audit_log` have 0 rows despite triggers being defined. Either the triggers are not firing or no relevant operations have occurred yet.
- `events` table is the primary activity log (364 entries over 5 days)
- `command_log` is empty — the command/NLP pipeline may not be in production use yet

---

## 4. INTEGRATION HEALTH (SI-2)

| Integration | Status | Last Sync |
|-------------|--------|-----------|
| QuickBooks (QB -> ERP) | Connected | Feb 11, 19:35 UTC |
| Gmail (saurabh) | Connected | Feb 9 |
| Gmail (kourosh) | Connected | Feb 9 |
| Facebook x2 | Connected | Feb 8-9 |
| Instagram x2 | Connected | Feb 8-9 |
| Google Calendar | Connected | Feb 9 |
| Google Drive | Connected | Feb 9 |
| YouTube | Connected | Feb 9 |
| Google Analytics | Connected | Feb 9 |
| RingCentral | Edge function active (boot/shutdown cycles every 60s) |
| Odoo (legacy) | Secrets configured, sync functions deployed |

### Findings
- RingCentral edge function is boot-cycling every ~60s (scheduled sync or health-check pattern — normal)
- Auth logs show repeated `bad_jwt` / `missing sub claim` errors from `cusum-brain-flow.lovable.app` every minute — this is the published app polling `/user` with an expired or anonymous token. **Not a security breach** but indicates a session-refresh issue on the live site.

---

## 5. SECURITY / INTEGRITY (SI-7)

| Control | Status |
|---------|--------|
| RLS on all public tables | YES (0 exceptions) |
| Gmail tokens AES-256 encrypted | YES (TOKEN_ENCRYPTION_KEY secret set) |
| RC tokens deny-all for clients | YES (server-side only) |
| PII masking via `profiles_safe` / `contacts_safe` views | YES |
| Bulk access alerting (>50 contacts) | YES (`log_contact_bulk_access` function) |
| Rate limiting | YES (`check_rate_limit` + `rate_limit_entries` table) |
| Storage signed URLs | Private buckets configured (estimation-files, clearance-photos, face-enrollments, meeting-recordings) |
| Service role key server-side only | YES (edge functions only) |

### Findings
- Security posture is strong for the application tier
- No CVE scan has been performed on dependencies (57 npm packages + Deno imports)

---

## 6. PERFORMANCE

| Metric | Value |
|--------|-------|
| Largest table | 43,954 rows (lead_activities) — well within limits |
| DB checkpoint frequency | ~5 min intervals (healthy) |
| Checkpoint duration | 1-6 seconds (normal) |
| WAL recycling | Active, 2-3 files per cycle |
| No `pg_stat_statements` evidence | Cannot verify slow queries from available tools |

---

## 7. BACKUP / DR (CP-9)

| Item | Status |
|------|--------|
| Lovable Cloud automated backups | Platform-managed (not user-accessible) |
| RPO/RTO defined | NOT SET |
| Restore test performed | NO EVIDENCE |
| Manual export capability | `get_table_stats` RPC + `diagnostic-logs` edge function available |

### Findings
- **GAP**: No documented RPO/RTO targets
- **GAP**: No restore test evidence
- Backups are managed by the platform infrastructure — user cannot independently verify

---

## 8. VULNERABILITY / CVE

| Item | Status |
|------|--------|
| Dependency CVE scan | NOT PERFORMED |
| npm packages | 57 direct dependencies |
| Deno edge function imports | ~57 functions with external imports |
| Known auth issue | `bad_jwt` polling on published site (session handling, not a vulnerability) |

---

## Priority Action Items

| # | Issue | Severity | Owner | ETA |
|---|-------|----------|-------|-----|
| 1 | Investigate 3 orphaned profiles | Medium | Admin | 1 day |
| 2 | Fix `bad_jwt` polling on published site | Medium | Dev | 1-2 days |
| 3 | Verify audit triggers are firing (contact/financial/payroll logs all empty) | High | Dev | 1 day |
| 4 | Define RPO/RTO targets | Critical | IT/Mgmt | 1-3 days |
| 5 | Run npm audit + Deno dependency scan | Medium | Dev | 1 day |
| 6 | Document backup/restore procedure | Critical | IT | 2-7 days |
| 7 | Populate `command_log` or remove dead code | Low | Dev | 3 days |

---

## Instance Record (filled)

| Field | Value |
|-------|-------|
| Instance | CUSUM Rebar ERP |
| Env | Production (Lovable Cloud) |
| Host | `cusum-brain-flow.lovable.app` |
| Ver | React 18 + Vite + Supabase |
| Mods | 57 edge functions, 87 tables, 8 storage buckets |
| Owner | sattar@rebar.shop (super-admin) |

