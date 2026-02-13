

# Odoo Decommission: Full Reconciliation and ERP Cleanup

## Current State Summary (Updated 2026-02-13)

| Table | Total Records | QB-Linked | Odoo-Only / Orphaned | Status |
|-------|---:|---:|---:|---|
| customers | 2,733 | 1,951 active (has QB ID or orders) | 782 archived_odoo_only | ✅ Done |
| quotes | 2,586 | N/A (all from Odoo) | 75 flagged archived_orphan | ✅ Done |
| orders | 17 | 0 (no QB invoice) | All 17 pending | ⚠️ Manual review needed |
| leads | 2,712 | 2,678 (has customer) | 34 flagged archived_orphan | ✅ Done |
| lead_activities | 44,083 | -- | All from Odoo | Historical archive, no action |
| lead_files | 18,323 | 571 migrated to storage | 17,752 still referencing Odoo URLs | 🔴 CRITICAL - In progress |
| accounting_mirror | 1,902 | 1,821 invoices linked | 1 orphan (QB ID 2232, $0 bal) | ✅ 16 deleted (not in QB), 1 needs manual link |
| deliveries | 0 | -- | -- | No conflicts |

---

## Completed Actions

### ✅ Phase 2: Customer Reconciliation
- 782 Odoo-only customers (no QB ID, no orders) → `status = 'archived_odoo_only'`
- 5 customers with orders kept active for manual QB linking
- 1,951 active customers confirmed

### ✅ Phase 3: Invoice Linking
- Created `relink-orphan-invoices` edge function
- Re-fetched all 17 orphaned invoices from QB API
- Result: 16 invoices no longer exist in QuickBooks → deleted from mirror (QB is source of truth)
- 1 remaining (QB ID 2232, DocNumber 1260, $0 balance) — CustomerRef points to QB customer 894 which has no ERP match. Needs manual customer sync or linking.

### ✅ Phase 4: Quote and Lead Cleanup
- 75 orphaned quotes → `status = 'archived_orphan'`
- 34 orphaned leads → `stage = 'archived_orphan'`

---

## Remaining Work

### 🔴 CRITICAL: Phase 1 — File Migration (17,752 remaining)
- The `archive-odoo-files` edge function migrates ~20-50 files per batch (50s timeout)
- **Must complete before Odoo shutdown**
- To run: Call `POST /archive-odoo-files` repeatedly until remaining = 0
- Monitor: `SELECT count(*) FROM lead_files WHERE storage_path IS NULL AND odoo_id IS NOT NULL`
- Estimate: ~350-890 batches remaining

### Phase 5: Odoo Shutdown (after file migration)
1. Delete edge functions: `sync-odoo-leads`, `sync-odoo-quotations`, `archive-odoo-files`, `odoo-file-proxy`, `relink-orphan-invoices`
2. Remove `pipeline-ai/odooHelpers.ts`
3. Remove Odoo function entries from `supabase/config.toml`
4. Remove Odoo secrets (`ODOO_URL`, `ODOO_USERNAME`, `ODOO_API_KEY`, `ODOO_DATABASE`)
5. Rename or remove `useOdooQuotations.ts`

### Manual Items for Team
- 17 orders in "pending" — accounting team should review and push to QB
- Invoice 2232 (QB customer 894) — manually link or sync QB customer 894 to ERP
- Order items nearly empty (1 record) — line items must be manually entered

---

## Safe Odoo Shutdown Checklist

- [ ] All 18,323 lead files migrated to Supabase storage (currently 571/18,323)
- [ ] All `file_url` values updated to Supabase URLs
- [x] 782 Odoo-only customers flagged as `archived_odoo_only`
- [x] 16 deleted invoices cleaned from mirror (not in QB)
- [x] 75 orphaned quotes flagged as archived_orphan
- [x] 34 orphaned leads flagged as archived_orphan
- [ ] Odoo sync edge functions deleted
- [ ] Odoo secrets removed
- [ ] Odoo UI references cleaned up
- [ ] Final verification: zero live Odoo API calls remain in codebase
- [x] QB confirmed as sole financial source of truth
