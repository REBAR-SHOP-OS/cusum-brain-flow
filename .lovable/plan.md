

# Fix: Invoice #2277 Missing — Sync Gap Between QB Systems

## Root Cause

There are **two independent sync systems** that don't communicate:

| System | Target Table | Last Synced | Status |
|--------|-------------|-------------|--------|
| `quickbooks-oauth` (sync-invoices) | `accounting_mirror` | **Feb 13** (1+ month stale) | Used by customer portal, CEO dashboard, agents |
| `qb-sync-engine` (backfill/incremental) | `qb_transactions` | **Today** (current) | Used for GL normalization, trial balance |

The `qb-sync-engine` runs regularly and keeps `qb_transactions` up to date, but it **never writes to `accounting_mirror`**. Meanwhile, `accounting_mirror` is the table read by 14+ components across the app (customer portal, invoices, AR aging, CEO dashboard, etc.).

Invoice #2277 specifically doesn't exist in either table — it may not have been created in QuickBooks at all (there's a gap: 2276 → 2278 in `qb_transactions`). But the broader problem is that invoices 2231–2285 exist in `qb_transactions` but are completely missing from `accounting_mirror`.

## Solution

Add a **mirror sync step** to the `qb-sync-engine` that writes Invoice and Bill data to `accounting_mirror` after upserting to `qb_transactions`. This ensures both tables stay in sync from a single source of truth.

### Changes

**File: `supabase/functions/qb-sync-engine/index.ts`**

1. Add a new helper function `syncToAccountingMirror(svc, companyId, entityType, transactions)` that:
   - Filters for entity types used by `accounting_mirror` (Invoice, Bill, Payment, Estimate, CreditMemo)
   - Maps QB transaction data to the `accounting_mirror` schema (quickbooks_id, entity_type, balance, customer_id, data JSONB, last_synced_at)
   - Resolves `customer_id` by looking up `customers.quickbooks_id` from the QB CustomerRef
   - Upserts in batches to `accounting_mirror` using `onConflict: "quickbooks_id"`

2. Call `syncToAccountingMirror` at the end of both `handleBackfill` and `handleIncremental` after the transaction upsert loop completes.

3. The `data` JSONB will include the same fields the old `quickbooks-oauth` sync stored: `DocNumber`, `TotalAmt`, `DueDate`, `TxnDate`, `CustomerName`, `EmailStatus`, `Balance`, `Line`, `BillEmail`, `CustomerRef`.

This is a non-breaking addition — the existing `qb_transactions` flow is untouched. It simply adds a secondary write to keep `accounting_mirror` current.

### Why Not Just Fix the Old Sync?

The `quickbooks-oauth` sync-invoices function requires a user-initiated call with auth. The `qb-sync-engine` runs automatically (cron/backfill). Adding the mirror write to the engine that already runs ensures continuous freshness without manual intervention.

