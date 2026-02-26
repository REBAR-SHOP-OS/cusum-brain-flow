

# Odoo Detach Readiness Report

---

## PHASE 1 -- Dependency Audit

### 1A. Edge Functions That Call Odoo (JSON-RPC)

| Function | Purpose | Direction | Status |
|----------|---------|-----------|--------|
| `odoo-crm-sync` | Syncs ~2,990 leads from Odoo CRM | Inbound (Odoo → ERP) | **Active cron: every 15 min** |
| `odoo-chatter-sync` | Imports chatter messages/activities | Inbound | **Active cron: hourly** |
| `odoo-sync-order-lines` | Pulls sale.order.line items for quotes | Inbound | On-demand (triggered from ConvertQuoteDialog) |
| `odoo-reconciliation-report` | Compares Odoo vs ERP data for drift | Read-only audit | On-demand |
| `odoo-file-proxy` | Proxies file downloads from Odoo ir.attachment | Inbound file access | On-demand (used in LeadTimeline) |
| `archive-odoo-files` | Migrates Odoo attachments to local storage | Migration tool | On-demand (admin card) |
| `autopilot-engine` | Contains `odoo_write` tool + rollback logic | **Outbound (ERP → Odoo)** | Active (AI writes back to Odoo) |

### 1B. Cron Jobs

| Job ID | Name | Schedule | Target |
|--------|------|----------|--------|
| 4 | `odoo-crm-sync-incremental` | `*/15 * * * *` | `odoo-crm-sync` |
| 5 | `odoo-chatter-sync-hourly` | `0 * * * *` | `odoo-chatter-sync` |

### 1C. Environment Secrets Used

- `ODOO_URL`
- `ODOO_API_KEY`
- `ODOO_DATABASE`
- `ODOO_USERNAME`

### 1D. Database Columns with Odoo References

| Table | Column | Data Volume |
|-------|--------|-------------|
| `leads` | `metadata.odoo_id` (JSONB) | 2,990 leads sourced from Odoo |
| `quotes` | `odoo_id`, `odoo_status` | 2,586 quotes from Odoo |
| `lead_files` | `odoo_id` | 15,787 files (527 migrated, **15,260 NOT yet migrated**) |
| `lead_activities` | `odoo_message_id` | 39,836 chatter records |
| `sync_validation_log` | `odoo_id` | Validation audit trail |
| `ventures` | `odoo_context` | Venture planning metadata |

### 1E. Frontend Components Referencing Odoo

| File | Usage |
|------|-------|
| `OdooMigrationStatusCard.tsx` | Admin card for file migration progress |
| `OdooDumpImportDialog.tsx` | Import from Odoo data dump |
| `ArchivedQuotations` page | Displays `source=odoo_sync` quotes |
| `ConvertQuoteDialog.tsx` | Calls `odoo-sync-order-lines` before converting |
| `LeadTimeline.tsx` | Shows Odoo chatter, proxies Odoo files |
| `SwipeableLeadCard.tsx` | Reads `metadata.odoo_revenue` |
| `PipelineAISheet.tsx` | Reads `metadata.odoo_salesperson` |
| `RepPerformanceDashboard.tsx` | Reads `metadata.odoo_salesperson` |
| `Sidebar.tsx` | Comments reference "Odoo-style" (cosmetic only) |
| `agentConfigs.ts` | Architect agent mentions Odoo diagnostics |

### 1F. Shared Utilities

- `supabase/functions/_shared/odoo-validation.ts` -- Validation layer for Odoo lead sync

---

## PHASE 2 -- Source of Truth Validation

### Are Tables Locally Authoritative?

| Table | Local Authority? | Notes |
|-------|-----------------|-------|
| `customers` | **YES** | All customer records exist locally. Odoo sync creates them but they are self-contained. |
| `leads` | **YES** | 2,990 leads fully copied with all fields. No read-time dependency on Odoo. |
| `orders` | **YES** | Created locally. `odoo-sync-order-lines` enriches but order exists independently. |
| `deliveries` | **YES** | Fully local. No Odoo dependency. |
| `inventory` | **YES** | Fully local. No Odoo dependency. |
| `invoices` | **YES** | Managed by QuickBooks integration, not Odoo. |
| `activity_events` | **YES** | Local ledger. Odoo chatter imported as historical data. |
| `lead_activities` | **YES** | 39,836 records already copied locally. |
| `quotes` | **YES** | 2,586 quotes fully stored with metadata. |

### Write Operations Depending on Odoo

| Operation | Dependency | Risk |
|-----------|-----------|------|
| `autopilot-engine` `odoo_write` tool | **WRITES TO ODOO** -- AI can mutate Odoo CRM records | Medium -- only if you want bidirectional sync to stop |
| `ConvertQuoteDialog` line sync | Fetches line items from Odoo before order creation | Medium -- lines may not exist locally for unconverted quotes |
| `odoo-file-proxy` | Downloads files on-demand from Odoo | **HIGH -- 15,260 files NOT YET migrated to local storage** |

### Production/Delivery Callbacks

None. No production, delivery, or accounting workflow depends on Odoo callbacks.

---

## PHASE 3 -- Detach Readiness Assessment

### RISK LEVEL: **MEDIUM**

The primary blocker is the **15,260 unmigrated files** still served via `odoo-file-proxy`. If Odoo is shut down, these files become inaccessible.

### Pre-Detach Blockers

1. **File Migration Incomplete**: 15,260 of 15,787 Odoo files have NOT been archived to local storage. Must complete `archive-odoo-files` migration runs before detaching.
2. **Quote Line Items**: Quotes that have not yet been converted to orders may need their line items synced one final time via `odoo-sync-order-lines` batch mode.

### Safe Detach Plan (Once Blockers Resolved)

**Step 1 -- Complete File Migration**
- Run `archive-odoo-files` repeatedly until `remaining = 0`
- This moves all 15,260 files from Odoo to local storage

**Step 2 -- Final Data Snapshot**
- Run `odoo-crm-sync` with `mode: "full"` one last time
- Run `odoo-chatter-sync` with `mode: "full"` one last time
- Run `odoo-sync-order-lines` with `mode: "batch"` for all quotes
- Run `odoo-reconciliation-report` to confirm 100% parity

**Step 3 -- Disable Cron Jobs**
- SQL: `SELECT cron.unschedule(4);` (odoo-crm-sync-incremental)
- SQL: `SELECT cron.unschedule(5);` (odoo-chatter-sync-hourly)

**Step 4 -- Disable Autopilot Odoo Write**
- In `autopilot-engine/index.ts`, make the `odoo_write` tool return `{ success: false, error: "Odoo integration disabled" }` when `ODOO_ENABLED` env is not `true`

**Step 5 -- Guard All Edge Functions**
- Add early-return guard to these functions checking for `ODOO_ENABLED !== "true"`:
  - `odoo-crm-sync`
  - `odoo-chatter-sync`
  - `odoo-sync-order-lines`
  - `odoo-reconciliation-report`
  - `odoo-file-proxy`
  - `archive-odoo-files`

**Step 6 -- Frontend Cleanup**
- `ConvertQuoteDialog`: Skip Odoo line sync call (lines already in quote metadata)
- `LeadTimeline`: Use local `storage_path` for files, remove Odoo proxy fallback for migrated files
- `OdooMigrationStatusCard`: Show "Migration Complete" state, disable run button
- No changes to data display components (they read from local `metadata` JSONB)

**Step 7 -- Remove Secrets (After Verification Period)**
- Remove `ODOO_URL`, `ODOO_API_KEY`, `ODOO_DATABASE`, `ODOO_USERNAME` from secrets
- Set `ODOO_ENABLED=false` as feature flag

### Files to Disable/Modify

| File | Action |
|------|--------|
| `supabase/functions/odoo-crm-sync/index.ts` | Add `ODOO_ENABLED` guard |
| `supabase/functions/odoo-chatter-sync/index.ts` | Add `ODOO_ENABLED` guard |
| `supabase/functions/odoo-sync-order-lines/index.ts` | Add `ODOO_ENABLED` guard |
| `supabase/functions/odoo-reconciliation-report/index.ts` | Add `ODOO_ENABLED` guard |
| `supabase/functions/odoo-file-proxy/index.ts` | Add `ODOO_ENABLED` guard |
| `supabase/functions/archive-odoo-files/index.ts` | Keep active until migration done, then guard |
| `supabase/functions/autopilot-engine/index.ts` | Guard `odoo_write` tool |
| `supabase/functions/_shared/odoo-validation.ts` | Keep (no runtime cost, used by sync) |
| Cron jobs 4, 5 | Unschedule via SQL |

### Migrations Needed

1. Unschedule cron jobs (SQL insert, not migration)
2. No schema changes needed -- `odoo_id` columns are harmless historical references

### What This Does NOT Touch

- QuickBooks integration (untouched)
- All local business logic (untouched)
- Existing data in `metadata.odoo_*` fields (preserved as historical record)
- No table drops, no column drops

### Summary

| Dimension | Assessment |
|-----------|-----------|
| **Risk Level** | **Medium** (due to 15,260 unmigrated files) |
| **Blocker** | File migration must complete first |
| **Data Authority** | All tables are locally authoritative |
| **Outbound Writes** | Only `autopilot-engine` writes to Odoo |
| **Accounting** | Zero Odoo dependency (QuickBooks handles it) |
| **Estimated Effort** | 2 implementation rounds after file migration completes |

