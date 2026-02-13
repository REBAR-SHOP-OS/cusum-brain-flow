

# Odoo Decommission: Full Reconciliation and ERP Cleanup

## Current State Summary

| Table | Total Records | QB-Linked | Odoo-Only / Orphaned | Issues |
|-------|---:|---:|---:|---|
| customers | 2,733 | 1,946 (has QB ID) | 787 (no QB ID) | 787 Odoo-only customers not flagged as archived |
| quotes | 2,586 | N/A (all from Odoo) | 75 orphaned (no customer_id) | All 2,586 are Odoo-synced, read-only archive |
| orders | 17 | 0 (no QB invoice) | All 17 pending | None linked to QB yet |
| leads | 2,712 | 2,678 (has customer) | 34 orphaned (no customer_id) | 2,668 from Odoo sync |
| lead_activities | 44,083 | -- | All from Odoo | Historical archive |
| lead_files | 18,323 | 485 migrated to storage | 17,838 still referencing Odoo URLs | Critical: Odoo URLs will break on shutdown |
| accounting_mirror | 1,918 | 1,821 invoices linked | 17 invoices orphaned (no customer_id) | QB data lacks CustomerRef in JSONB |
| deliveries | 0 | -- | -- | Empty table, no conflicts |
| integration_connections | None for Odoo | -- | -- | Already removed |

---

## Issues Found (Prioritized)

### CRITICAL (P0) -- Must fix before Odoo shutdown

**1. 17,838 lead files still reference Odoo URLs**
- Root cause: The `archive-odoo-files` edge function has only migrated 485 of 18,323 files. The remaining 17,838 have `file_url` pointing to Odoo servers and no `storage_path`.
- Correct value: Each file needs to be downloaded from Odoo and uploaded to the `estimation-files` Supabase storage bucket.
- Fix: Run the `archive-odoo-files` edge function in batches until all files are migrated. Update `file_url` to point to Supabase storage after migration. This must happen while Odoo is still accessible.
- Estimate: ~367 batches at 50 files/batch.

**2. 787 customers with no QuickBooks ID not flagged as archived**
- Root cause: The Odoo decommission memory says orphaned Odoo customers should be marked `archived_odoo_only`, but all 2,733 customers currently have `status = 'active'`.
- Correct value: Customers without a QB ID that are not referenced by any active orders should be `status = 'archived_odoo_only'`.
- Fix: SQL migration to add `archived_odoo_only` as a valid status and update the 787 records. Preserve the 5 that have orders (keep them active for manual QB linking).

### HIGH (P1) -- Fix for data integrity

**3. 17 orphaned invoices in accounting_mirror (no customer_id)**
- Root cause: When QB invoices were synced to the mirror table, the `CustomerRef` field was not stored in the JSONB `data` column (all 17 show null for CustomerRef). Without it, the system cannot auto-link invoices to ERP customers.
- Correct value: Re-fetch these 17 invoices from QuickBooks with full CustomerRef data.
- Fix: Create a targeted re-sync that fetches invoices by their QB IDs (122-180, 2232), extracts CustomerRef, and links `customer_id` by matching `CustomerRef.value` to `customers.quickbooks_id`.

**4. 75 orphaned quotes (no customer_id)**
- Root cause: During Odoo sync, the partner/customer mapping failed for these 75 quotations -- likely the Odoo partner didn't match any ERP customer.
- Correct value: These are historical Odoo quotes. Since they cannot be matched to QB customers, they should be flagged with a `status = 'archived_orphan'` or linked if a name match exists.
- Fix: Attempt fuzzy name matching against existing customers. Flag remaining unmatched as archived.

**5. 34 orphaned leads (no customer_id)**
- Root cause: Same as quotes -- Odoo sync created leads without matching to an ERP customer.
- Fix: Attempt name-based matching. Flag remaining as archived.

### MEDIUM (P2) -- Cleanup for operational clarity

**6. All 17 orders stuck in "pending" with no QB invoice**
- Root cause: These orders were created from Odoo quotes via `convert-quote-to-order` but never pushed to QuickBooks.
- Fix: No automated fix needed. These are operational items for the accounting team to review and push to QB when ready. Ensure the UI makes it clear.

**7. Order items table nearly empty (1 record, no rebar metadata)**
- Root cause: Per the memory note, Odoo sync doesn't support `sale.order.line` objects, so line items require manual entry.
- Fix: No schema change needed. Document that line items must be manually entered for converted orders.

### LOW (P3) -- Shutdown cleanup

**8. Odoo edge functions still deployed**
- Functions to disable/delete: `sync-odoo-leads`, `sync-odoo-quotations`, `sync-odoo-history`, `archive-odoo-files` (after migration complete).
- Also remove `pipeline-ai/odooHelpers.ts` Odoo helper imports.
- Fix: Delete these edge functions and remove Odoo references from `supabase/config.toml`.

**9. Odoo secrets still configured**
- Secrets: `ODOO_URL`, `ODOO_USERNAME`, `ODOO_API_KEY`, `ODOO_DATABASE`.
- Fix: Remove after file migration is complete and edge functions are deleted.

**10. Odoo UI references to clean up**
- `useOdooQuotations.ts` hook (already read-only, but references Odoo in naming).
- Fix: Rename to reflect archive nature or remove if not actively used.

---

## Execution Plan

### Phase 1: File Migration (BEFORE Odoo shutdown)
1. Run `archive-odoo-files` in repeated batches until all 17,838 remaining files are migrated
2. After each batch, verify counts: `SELECT count(*) FROM lead_files WHERE storage_path IS NULL AND odoo_id IS NOT NULL`
3. Update `file_url` for migrated files to point to Supabase storage URLs
4. Verify zero files remain with Odoo-only URLs

### Phase 2: Customer Reconciliation
1. Add migration: allow `archived_odoo_only` as a customer status
2. Flag 782 Odoo-only customers (no QB ID, no active orders) as `archived_odoo_only`
3. Keep 5 customers with orders as `active` for manual QB linking

### Phase 3: Invoice Linking
1. Create edge function or one-time script to re-fetch 17 orphaned invoices from QB API
2. Extract CustomerRef, match to `customers.quickbooks_id`, update `accounting_mirror.customer_id`

### Phase 4: Quote and Lead Cleanup
1. Attempt name matching for 75 orphaned quotes and 34 orphaned leads
2. Flag unmatched as archived

### Phase 5: Odoo Shutdown
1. Delete edge functions: `sync-odoo-leads`, `sync-odoo-quotations`, `sync-odoo-history`
2. Delete `archive-odoo-files` (after Phase 1 is fully complete)
3. Remove `pipeline-ai/odooHelpers.ts`
4. Remove Odoo function entries from `supabase/config.toml`
5. Remove Odoo secrets (`ODOO_URL`, `ODOO_USERNAME`, `ODOO_API_KEY`, `ODOO_DATABASE`)
6. Rename or remove `useOdooQuotations.ts`

---

## Safe Odoo Shutdown Checklist

- [ ] All 18,323 lead files migrated to Supabase storage (currently 485/18,323)
- [ ] All `file_url` values updated to Supabase URLs
- [ ] 787 Odoo-only customers flagged as `archived_odoo_only`
- [ ] 17 orphaned invoices re-linked to customers via QB API
- [ ] 75 orphaned quotes flagged/archived
- [ ] 34 orphaned leads flagged/archived
- [ ] Odoo sync edge functions deleted
- [ ] Odoo secrets removed
- [ ] Odoo UI references cleaned up
- [ ] Final verification: zero live Odoo API calls remain in codebase
- [ ] QB is confirmed as sole financial source of truth (already true)

---

## Technical Details

### Migration SQL for Customer Archival (Phase 2)
```sql
-- Flag Odoo-only customers as archived
UPDATE customers 
SET status = 'archived_odoo_only'
WHERE quickbooks_id IS NULL 
  AND id NOT IN (SELECT DISTINCT customer_id FROM orders WHERE customer_id IS NOT NULL);
```

### Invoice Re-linking Query (Phase 3)
Will require a new edge function that calls QB API to fetch invoice details for IDs 122-180, 2232, extracts `CustomerRef.value`, and runs:
```sql
UPDATE accounting_mirror am
SET customer_id = c.id
FROM customers c
WHERE c.quickbooks_id = [extracted_CustomerRef_value]
  AND am.quickbooks_id = [invoice_qb_id]
  AND am.entity_type = 'Invoice'
  AND am.customer_id IS NULL;
```

### Edge Functions to Delete (Phase 5)
- `supabase/functions/sync-odoo-leads/`
- `supabase/functions/sync-odoo-quotations/`
- `supabase/functions/sync-odoo-history/`
- `supabase/functions/archive-odoo-files/` (after migration)
- `supabase/functions/pipeline-ai/odooHelpers.ts`

### Config.toml Entries to Remove
```
[functions.sync-odoo-leads]
[functions.sync-odoo-quotations]
[functions.archive-odoo-files]
```

