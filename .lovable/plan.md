

# Fix Payment History: Sync Payment Records from QuickBooks

## Problem

The Payment History section only shows a generic "Total payments received" fallback because the database has **zero** Payment records. The sync engine supports Payment syncing, but a full backfill times out (too many entity types). An incremental sync was triggered and synced 3 recent payments, confirming the data pipeline works -- but historical payments are missing.

## Solution

Add a targeted "sync-entity" action to the sync engine that syncs only one entity type (e.g., Payment) without timing out. Then, on the frontend, add a "Sync Payments" button in the InvoiceEditor so users can trigger it when payment history is missing.

## Changes

### 1. Edge Function: `supabase/functions/qb-sync-engine/index.ts`

Add a new `sync-entity` action that:
- Accepts `entity_type` parameter (e.g., "Payment")
- Runs the same backfill logic but only for that single entity type
- Completes within the edge function timeout since it's scoped to one type

Add to the switch statement:
```
case "sync-entity":
  return jsonRes(await handleSyncEntity(svc, companyId, body.entity_type));
```

The `handleSyncEntity` function will:
- Connect to QB using existing `getCompanyQBConfig`
- Query all records for the specified entity type
- Upsert them using `upsertTransactions`
- Normalize to GL
- Log the sync

### 2. Frontend: `src/components/accounting/InvoiceEditor.tsx`

When `linkedPayments` is empty but `paid > 0`:
- Show a "Sync Payment Records" button alongside the fallback display
- On click, call `qbAction("sync-entity", { entity_type: "Payment" })` then reload
- After sync, the linked payments will populate from the newly synced Payment records

This requires:
- Adding `qbAction` to the component props (or passing a `onSyncPayments` callback)
- Adding a loading state for the sync button

### 3. Frontend: `src/components/accounting/AccountingInvoices.tsx`

Pass a `onSyncPayments` callback to `InvoiceEditor` that calls the sync engine and reloads data.

## Technical Details

### New edge function action: `sync-entity`

Request:
```json
{ "action": "sync-entity", "entity_type": "Payment" }
```

Response:
```json
{ "entity_type": "Payment", "synced": 245, "errors": [], "duration_ms": 3500 }
```

### Data flow after sync

1. User opens invoice with Balance = 0 but no linked payments visible
2. User clicks "Sync Payment Records"
3. Edge function queries all Payment records from QuickBooks API
4. Records are upserted into `qb_transactions` with `entity_type = 'Payment'`
5. Frontend reloads data, `payments` array now populated
6. `linkedPayments` memo finds matching payments via `Line[].LinkedTxn[].TxnId`
7. Payment history table renders with individual dates and amounts

### Files modified
- `supabase/functions/qb-sync-engine/index.ts` -- add `sync-entity` action + handler
- `src/components/accounting/InvoiceEditor.tsx` -- add sync button + callback prop
- `src/components/accounting/AccountingInvoices.tsx` -- pass sync callback to InvoiceEditor
