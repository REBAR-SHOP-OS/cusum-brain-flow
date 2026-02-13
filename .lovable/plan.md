
# QB + Odoo to ERP Consolidation and Odoo Decommission Plan

## Current Data Inventory

### Data Counts Across Systems

| Entity | ERP (DB) Total | From Odoo | From QB | Orphaned/Manual |
|--------|---------------|-----------|---------|-----------------|
| Customers | 2,733 | Unknown origin | 1,946 (have QB ID) | 787 without QB ID |
| Leads | 2,712 | 2,668 | 0 | 44 non-Odoo |
| Quotes | 2,586 | 2,586 (all) | 0 | 0 |
| Lead Files | 18,323 | 18,323 (all) | 0 | 0 |
| Lead Activities | 44,083 | 41,441 | 0 | 2,642 non-Odoo |
| Orders | 17 | 0 | 0 (none pushed) | 17 manual |
| Accounting Mirror | 1,918 | 0 | 1,918 (all) | 0 |

### Key Findings

1. **Leads/Pipeline are 98% Odoo data** -- 2,668 of 2,712 leads came from Odoo sync. This data has operational value (customer history, file attachments, activity logs) and does NOT exist in QuickBooks.
2. **All 2,586 quotes are from Odoo** -- none from QB. These represent sales history.
3. **18,323 lead files are Odoo-proxied** -- currently served via the `odoo-file-proxy` edge function that calls Odoo's API live. These files will be LOST when Odoo is shut down unless archived.
4. **787 customers lack a QB ID** -- these may be Odoo-only customers not in QuickBooks.
5. **Orders are thin** -- only 17, none linked to quotes or QB invoices yet.

---

## Phase 1: Data Comparison and Conflict Resolution

### Authority Rules Applied

- **QB always wins** for: customers, invoices, payments, accounts, vendors, bills
- **Odoo data kept** only if it adds operational value not in QB: leads, pipeline history, file attachments, activity logs, salesperson assignments
- **ERP reflects QB** for all financial data; Odoo metadata kept as read-only archive

### Conflicts to Resolve

| Issue | Source | Correct Value | Impact | Fix | Priority |
|-------|--------|--------------|--------|-----|----------|
| 787 customers without QB ID | ERP (from Odoo) | Must match to QB or archive | Orphaned customer records | Run QB customer sync, match by name, archive unmatched | High |
| Lead files served live from Odoo API | Odoo (live) | Must be self-hosted | Files disappear when Odoo dies | Bulk download to storage bucket before cutover | Critical |
| Quotes reference `odoo_id` column | ERP | Keep as archive reference | No functional impact after cutover | Mark column as deprecated, keep data | Low |
| `odoo_salesperson` in lead metadata | ERP metadata | Keep as historical reference | Pipeline filters use this field | Map to ERP profile IDs where possible | Medium |
| "View Odoo Quotations" button in Accounting | UI | Remove | Confusing post-cutover | Remove button and Odoo tab references | Medium |

---

## Phase 2: Fix ERP (IDs, URLs, Relationships)

### Database Changes

1. **Customer reconciliation**: Run QB `sync-customers` to ensure all QB customers are in ERP. For the 787 without QB IDs, attempt name-matching. Unmatched get flagged `status = 'archived_odoo_only'`.

2. **File migration**: Create a one-time edge function `archive-odoo-files` that:
   - Reads all `lead_files` where `odoo_id IS NOT NULL`
   - Downloads each file via the Odoo API
   - Uploads to the `estimation-files` storage bucket
   - Updates `lead_files.storage_path` and `lead_files.file_url` to point to storage
   - Clears dependency on live Odoo API

3. **URL cleanup**: Update `lead_files.file_url` from Odoo `/web/content/` URLs to storage bucket URLs after migration.

4. **Relationship mapping**: Orders should link to QB invoices via `quickbooks_invoice_id`. The `convert-quote-to-order` flow already does this correctly.

---

## Phase 3: Migration Execution Plan

### Step-by-step (in order)

1. **Sync all QB customers** -- run `sync-customers` to ensure ERP has every QB customer with correct `quickbooks_id`
2. **Match orphan customers** -- edge function to fuzzy-match 787 Odoo-only customers to QB by name/company
3. **Archive Odoo files** -- new edge function downloads all 18,323 files to storage bucket (batched, resumable)
4. **Update file URLs** -- after download, update `lead_files` rows to point to storage
5. **Freeze Odoo columns** -- mark `odoo_id`, `odoo_status`, `odoo_message_id` as deprecated (keep data, stop writing)
6. **Remove Odoo sync UI** -- remove sync buttons, "View Odoo Quotations" button, Odoo integration card
7. **Validate** -- run comparison queries to confirm all valuable data is accessible without Odoo

### Validation Checks
- All `lead_files` with `odoo_id` have a valid `storage_path`
- All customers with active orders have a `quickbooks_id`
- Pipeline page loads without calling any Odoo endpoint
- Accounting page works purely from QB data

### Rollback Strategy
- Odoo credentials stay in secrets until final validation
- Edge functions are disabled (not deleted) first
- Database columns are deprecated (not dropped) -- data preserved
- If issues found, re-enable Odoo sync functions temporarily

---

## Phase 4: Odoo Decommission

### What Must Be Preserved (read-only archive in ERP)
- 2,668 leads and their metadata (salesperson, priority, stage history)
- 44,083 lead activities and message history
- 18,323 files (migrated to storage bucket)
- 2,586 quotes with Odoo metadata in JSONB column
- `odoo_id` columns kept for historical reference

### What Can Be Discarded
- Live Odoo API connections
- `odoo-file-proxy` edge function (after file migration)
- `sync-odoo-leads` edge function
- `sync-odoo-quotations` edge function
- `sync-odoo-history` edge function
- Odoo integration status checks in `useIntegrations.ts`
- Odoo integration card in integrations list

### Cutover Checklist
1. All 18,323 files confirmed downloaded to storage
2. `LeadTimeline.tsx` updated to serve files from storage (not Odoo proxy)
3. Pipeline page works without Odoo API calls
4. QB customer sync covers all active customers
5. Odoo sync buttons removed from UI
6. Odoo removed from `ConnectionsAudit.tsx`
7. Odoo removed from `integrationsList.ts`
8. Edge functions disabled: `sync-odoo-leads`, `sync-odoo-quotations`, `sync-odoo-history`, `odoo-file-proxy`

### Risks
- **File migration volume**: 18,323 files may take multiple batched runs (edge function 50s limit)
- **Customer name mismatches**: Odoo and QB may use different name formats -- fuzzy matching needed
- **Historical salesperson data**: Pipeline filters use `metadata.odoo_salesperson` -- keep working as-is since data stays in JSONB

### Final Confirmation
Odoo can be safely shut down when ALL of the following are true:
- [ ] All lead files accessible from storage (zero Odoo proxy calls)
- [ ] All Odoo sync edge functions disabled
- [ ] UI has zero references to Odoo API endpoints
- [ ] Pipeline loads and filters work without Odoo
- [ ] Accounting works purely from QB
- [ ] CEO confirms "go" after 48h burn-in period

---

## Files to Modify

### Edge Functions (new)
- `supabase/functions/archive-odoo-files/index.ts` -- batch file migration

### Edge Functions (delete after migration)
- `supabase/functions/sync-odoo-leads/index.ts`
- `supabase/functions/sync-odoo-quotations/index.ts`
- `supabase/functions/sync-odoo-history/index.ts`
- `supabase/functions/odoo-file-proxy/index.ts`

### Frontend (modify)
- `src/components/pipeline/LeadTimeline.tsx` -- serve files from storage instead of Odoo proxy
- `src/pages/Pipeline.tsx` -- remove Odoo sync buttons
- `src/pages/AccountingWorkspace.tsx` -- remove "View Odoo Quotations" button
- `src/hooks/useIntegrations.ts` -- remove Odoo status checks and OAuth
- `src/hooks/useOdooQuotations.ts` -- remove (or keep as read-only DB query without sync)
- `src/pages/ConnectionsAudit.tsx` -- remove Odoo entry
- `src/components/integrations/integrationsList.ts` -- remove Odoo card

### Database
- No columns dropped (archive preservation)
- Add `status = 'archived_odoo_only'` for unmatched customers

### Secrets (remove after final validation)
- `ODOO_API_KEY`
- `ODOO_URL`
- `ODOO_DATABASE`
- `ODOO_USERNAME`
