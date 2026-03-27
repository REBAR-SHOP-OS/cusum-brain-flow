

# Auto-Sync ERP Invoice to QuickBooks + Fix InvoiceLink Preservation

## Problem
1. ERP invoices (created via accept_and_convert or manually) are never pushed to QuickBooks, so no QB `InvoiceLink` exists
2. The `handleSyncInvoices` in `quickbooks-oauth` stores a **reduced** invoice payload that strips `InvoiceLink` from the data
3. `handleCreateInvoice` creates QB invoices but doesn't mirror the result to `accounting_mirror`

## Plan

### 1. Fix `quickbooks-oauth/index.ts` — Preserve full invoice data in sync

In `handleSyncInvoices` (lines 942-963), change the reduced `data` object to store the full QB invoice object (like `qb-sync-engine` does at line 344). This ensures `InvoiceLink` and all other fields are preserved.

```text
Before:  data: { DocNumber, TotalAmt, DueDate, TxnDate, CustomerName, ... }
After:   data: invoice   (full QB object)
```

### 2. Fix `quickbooks-oauth/index.ts` — Mirror after create-invoice

In `handleCreateInvoice` (after line 1288), after the QB API returns the created invoice, upsert the result into `accounting_mirror` so the `InvoiceLink` is immediately available. Also store the QB invoice ID on the `sales_invoices` record in a metadata field for future lookups.

### 3. Auto-push to QuickBooks on send email

In `DraftInvoiceEditor.tsx` `handleSendEmail`, before looking up the QB payment link:
- Call `quickbooks-oauth` with `action: "create-invoice"` using the invoice's line items, customer, and amounts
- The response includes the full QB invoice with `InvoiceLink`
- Use the `InvoiceLink` directly from the response (no need for mirror lookup)
- Also works as a mirror write (from change #2)

### 4. Auto-push to QuickBooks on accept_and_convert

In `send-quote-email/index.ts`, after creating the Stripe payment link (line 553-576), add a similar call to push the invoice to QuickBooks:
- Call `quickbooks-oauth` with `action: "create-invoice"` using the service role key
- Extract `InvoiceLink` from the response
- Use it in the dual-button email HTML

### Flow after fix
```text
Quote accepted → Invoice created in ERP
  → Stripe payment link generated ✓ (already works)
  → QB invoice created via API → InvoiceLink returned
  → Both payment buttons in email ✓
  
Manual send email → QB invoice created via API
  → InvoiceLink returned → both buttons in email ✓
```

### Customer ID resolution
Both push flows need a QB customer ID. The code will:
1. Look up the customer in `customers` table for `quickbooks_id`
2. If not found, search QB by customer name
3. If still not found, create the customer in QB first

## Files Changed
- `supabase/functions/quickbooks-oauth/index.ts` — store full invoice object in sync, mirror after create-invoice
- `supabase/functions/send-quote-email/index.ts` — push invoice to QB during accept_and_convert
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — push invoice to QB during manual send email

