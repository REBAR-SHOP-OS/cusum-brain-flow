
# Fix "Unknown Customer" in AI Actions Queue

## Problem

The action cards show "Unknown Customer" because the `penny-auto-actions` edge function tries to read the customer name from the QuickBooks invoice JSON (`data->'CustomerRef'->'name'`), but that field is null in your synced data. Meanwhile, the `customer_id` column IS correctly populated and the actual customer names exist in the `customers` table.

## Root Cause

In `supabase/functions/penny-auto-actions/index.ts`, line 67-68:

```text
const customerRef = invData?.CustomerRef as ...;
const customerName = customerRef?.name ?? "Unknown Customer";
```

The `CustomerRef` inside the JSONB `data` column is null, so it always falls back to "Unknown Customer".

## Fix (two parts)

### 1. Update the edge function to look up real customer names

Modify `penny-auto-actions/index.ts` to:
- Batch-load all relevant customers from the `customers` table using the `customer_id` values already present on `accounting_mirror`
- Build a `customerNameMap` (customer_id -> name)
- Use `customerNameMap.get(inv.customer_id) ?? customerRef?.name ?? "Unknown Customer"` as the fallback chain

This is a small change -- just add a query after loading `overdueInvoices` and use the map when building the queue entries.

### 2. Backfill existing queue entries

Run a SQL update to fix the existing "Unknown Customer" rows in `penny_collection_queue` by joining through `accounting_mirror` to `customers`:

```text
UPDATE penny_collection_queue pq
SET customer_name = c.name
FROM accounting_mirror am
JOIN customers c ON am.customer_id = c.id
WHERE pq.invoice_id = am.quickbooks_id
  AND am.entity_type = 'Invoice'
  AND pq.customer_name = 'Unknown Customer'
  AND c.name IS NOT NULL;
```

## Result

- All existing "Unknown Customer" entries get corrected immediately
- Future scans will populate the correct customer name from the `customers` table
- No frontend changes needed -- the `AccountingActionQueue` component already displays `item.customer_name`
