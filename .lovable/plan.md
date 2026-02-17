
# Audit: Vendor Transactions Empty -- Root Cause and Fix

## Diagnosis

The Vendor Detail transaction list shows **"No transactions found"** because the `qb_transactions` database table contains **zero vendor-related records**:

| Entity Type | Count |
|---|---|
| Invoice | 1,827 |
| Payment | 1,843 |
| Transfer | 1 |
| **Bill** | **0** |
| **BillPayment** | **0** |
| **PurchaseOrder** | **0** |
| **VendorCredit** | **0** |

There are **80 active vendors** in `qb_vendors`, but no transactions linked to them. The sync engine code correctly includes `Bill`, `BillPayment`, `PurchaseOrder`, `VendorCredit` in its `TXN_TYPES` array, and the `vendor_qb_id` column is properly mapped. The data simply was never synced from QuickBooks.

The sync log shows only one incremental sync (14 records) -- the initial backfill either was never run for these entity types, timed out, or failed silently.

## Root Cause

No Bill/BillPayment/VendorCredit/PurchaseOrder data was ever backfilled from QuickBooks into `qb_transactions`.

## Fix

### 1. Add a "Sync Vendor Transactions" button to VendorDetail

Add a visible sync button in the VendorDetail transaction tab that triggers individual entity syncs for vendor-related types (Bill, BillPayment, VendorCredit, PurchaseOrder) using the existing `qb-sync-engine` edge function's `sync-entity` action.

**File: `src/components/accounting/VendorDetail.tsx`**
- Add a "Sync Transactions" button next to the filters in the transaction tab
- On click, call `qb-sync-engine` with `sync-entity` for Bill, BillPayment, VendorCredit, and PurchaseOrder sequentially
- Show loading state during sync
- Invalidate and refetch transactions query after sync completes

### 2. Add "Sync All Vendor Data" button to AccountingVendors list page

**File: `src/components/accounting/AccountingVendors.tsx`**
- Add a "Sync" button next to "Add Vendor"
- On click, trigger backfill for all vendor transaction types
- Show toast on completion with count of synced records

### 3. Auto-trigger vendor transaction sync on first empty load

**File: `src/components/accounting/VendorDetail.tsx`**
- If transactions query returns empty AND vendor has a non-zero balance in QB, automatically trigger a sync for Bill/BillPayment entities
- Show "Syncing vendor transactions from QuickBooks..." instead of "No transactions found"
- This ensures first-time users see data without manual action

## Technical Details

The sync calls will use:
```typescript
await supabase.functions.invoke("qb-sync-engine", {
  body: { action: "sync-entity", entity_type: "Bill" }
});
```

This calls the existing `handleSyncEntity` function which queries QuickBooks for all records of that type and upserts them into `qb_transactions` with proper `vendor_qb_id` mapping.

After sync, the existing `useQuery` with key `["qb_vendor_transactions", vendor.Id]` is invalidated to refetch from the now-populated table.

## Files Changed

| File | Change |
|---|---|
| `src/components/accounting/VendorDetail.tsx` | Add sync button + auto-sync on empty load |
| `src/components/accounting/AccountingVendors.tsx` | Add "Sync" button for bulk vendor transaction sync |
