

# Odoo Decommission: Full Reconciliation and ERP Cleanup

## Final Status (2026-02-13)

| Table | Total | QB-Linked | Odoo-Only / Orphaned | Status |
|-------|---:|---:|---:|---|
| customers | 2,733 | 1,951 active | 782 `archived_odoo_only` | ✅ Done |
| quotes | 2,586 | N/A (archived) | 75 `archived_orphan` | ✅ Done |
| orders | 17 | 0 (pending) | All 17 pending | ⚠️ Manual review |
| leads | 2,712 | 2,678 linked | 34 `archived_orphan` | ✅ Done |
| lead_activities | 44,083 | -- | Historical archive | No action needed |
| lead_files | 18,323 | 616 migrated | 17,707 pending | 🔴 In progress |
| accounting_mirror | 1,902 | 1,901 linked | 1 orphan (QB #2232) | ✅ 16 deleted |
| deliveries | 0 | -- | -- | Clean |

---

## All Issues Found

### ✅ RESOLVED

| # | Issue | Root Cause | Fix Applied | Priority |
|---|-------|-----------|-------------|----------|
| 1 | 782 customers without QB ID not archived | Odoo decommission didn't flag them | `status = 'archived_odoo_only'` for all without QB ID or orders | P0 |
| 2 | 16 orphaned invoices in accounting_mirror | QB deleted these invoices; stale mirror data | Deleted from mirror (QB is source of truth) | P1 |
| 3 | 75 orphaned quotes (no customer_id) | Odoo partner mapping failed during sync | Flagged `status = 'archived_orphan'` | P1 |
| 4 | 34 orphaned leads (no customer_id) | Same partner mapping failure | Flagged `stage = 'archived_orphan'` | P1 |
| 5 | `sync-odoo-leads` edge function live | No longer needed | Deleted function + removed from config.toml | P3 |
| 6 | `sync-odoo-quotations` edge function live | No longer needed | Deleted function + removed from config.toml | P3 |
| 7 | `sync-odoo-history` edge function live | No longer needed | Deleted function + removed from config.toml | P3 |
| 8 | `pipeline-ai/odooHelpers.ts` fetching live Odoo | AI context fetched from Odoo on every request | Deleted helper, pipeline-ai uses ERP data only | P1 |
| 9 | `useOdooQuotations.ts` hook naming | Referenced Odoo in name/exports | Replaced with `useArchivedQuotations.ts` | P3 |
| 10 | "Sync Odoo Quotations" button in UI | Dead button after decommission | Removed; replaced with "Archived" badge | P2 |
| 11 | `AccountingDocuments.tsx` Odoo references | UI referenced Odoo naming/sync | Rewritten to use archive hook, no Odoo refs | P2 |
| 12 | Pipeline.tsx "Odoo analysis" comments | Cosmetic Odoo references | Updated comments to "native to ERP" | P3 |

### ⚠️ REMAINING (requires action)

| # | Issue | Root Cause | Required Fix | Priority |
|---|-------|-----------|-------------|----------|
| 13 | 17,707 lead files still on Odoo URLs | Migration only 3.4% complete | Run `archive-odoo-files` ~390 more batches | P0 CRITICAL |
| 14 | 1 orphaned invoice (QB #2232, $0 bal) | QB customer 894 not in ERP | Manually sync customer 894 from QB or link | P2 |
| 15 | 17 orders in "pending" with no QB invoice | Created from Odoo quotes, never pushed to QB | Accounting team must review and push to QB | P2 |
| 16 | `odoo-file-proxy` edge function still live | Needed until file migration completes | Delete after all 18,323 files migrated | P3 |
| 17 | `archive-odoo-files` edge function still live | Needed for ongoing migration | Delete after migration completes | P3 |
| 18 | LeadTimeline.tsx still uses odoo-file-proxy | Fallback for unmigrated files | Remove after migration completes | P3 |
| 19 | Odoo secrets still configured | Needed for file migration | Remove after migration: ODOO_URL, ODOO_USERNAME, ODOO_API_KEY, ODOO_DATABASE | P3 |

---

## Safe Odoo Shutdown Checklist

- [ ] **BLOCKER**: All 18,323 lead files migrated to storage (currently 616/18,323 = 3.4%)
- [x] 782 Odoo-only customers flagged as `archived_odoo_only`
- [x] 16 stale invoices cleaned from mirror (deleted from QB)
- [x] 75 orphaned quotes flagged as `archived_orphan`
- [x] 34 orphaned leads flagged as `archived_orphan`
- [x] `sync-odoo-leads` deleted
- [x] `sync-odoo-quotations` deleted
- [x] `sync-odoo-history` deleted
- [x] `pipeline-ai/odooHelpers.ts` deleted (no more live Odoo API calls from AI)
- [x] `useOdooQuotations.ts` → `useArchivedQuotations.ts`
- [x] AccountingDocuments UI cleaned (no more "Sync Odoo" button)
- [x] Pipeline.tsx comments updated
- [ ] Delete `odoo-file-proxy` (after file migration)
- [ ] Delete `archive-odoo-files` (after file migration)
- [ ] Remove `odoo-file-proxy` ref from LeadTimeline.tsx (after file migration)
- [ ] Remove Odoo secrets (after file migration)
- [ ] Final verification: zero live Odoo API calls remain
- [x] QB confirmed as sole financial source of truth

---

## How to Complete File Migration

The `archive-odoo-files` edge function migrates ~45 files per batch (50s timeout).
At 17,707 remaining, you need ~394 more batches.

**To run manually:**
```
POST /functions/v1/archive-odoo-files
Authorization: Bearer <user_token>
```

**To monitor progress:**
```sql
SELECT count(*) FROM lead_files WHERE storage_path IS NULL AND odoo_id IS NOT NULL;
```

**After migration reaches 0:**
1. Delete `archive-odoo-files` and `odoo-file-proxy` edge functions
2. Remove Odoo proxy fallback from `LeadTimeline.tsx`
3. Delete Odoo secrets
4. Odoo can be safely shut down
