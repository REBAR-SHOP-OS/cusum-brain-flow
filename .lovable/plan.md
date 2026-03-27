
Fix the missing QuickBooks payment link by addressing the real data gap, not just the email/button UI.

## What I found
- The invoice email/editor already tries to show a QuickBooks payment link in both places:
  - `src/components/accounting/documents/DraftInvoiceEditor.tsx`
  - `supabase/functions/send-quote-email/index.ts`
- Both lookups depend on `accounting_mirror.data.InvoiceLink`.
- The backend currently has no such data:
  - `accounting_mirror` has invoice rows, but `InvoiceLink` is null for all checked records.
  - Query result shows `with_invoice_link = 0` for all mirrored invoices.
- There is also no mirrored QuickBooks invoice matching `INV-20260001`, so even the fallback lookup by ERP invoice number cannot find one.
- The mirror sync code is the root cause:
  - `supabase/functions/quickbooks-oauth/index.ts` stores only a reduced invoice payload and does not include `InvoiceLink`
  - even though the more general sync path in `supabase/functions/qb-sync-engine/index.ts` would preserve the full invoice object if it is used.

## Root cause
The app is not missing the button logic anymore. It is missing the QuickBooks customer-facing link data in the backend mirror, and likely the ERP invoice is not being created/synced into QuickBooks in time for lookup.

## Plan
### 1. Preserve QuickBooks payment link data in invoice sync
Update the invoice mirroring path in `supabase/functions/quickbooks-oauth/index.ts` so invoice records written to `accounting_mirror` include:
- `InvoiceLink`
- `Id`
- `CustomerRef`
- any other customer-payment fields already returned by QuickBooks

This makes the existing email/editor lookup actually work.

### 2. Make QB link lookup more reliable
Update both:
- `src/components/accounting/documents/DraftInvoiceEditor.tsx`
- `supabase/functions/send-quote-email/index.ts`

to resolve the QuickBooks invoice using a safer fallback chain:
```text
1. exact DocNumber match in accounting_mirror
2. local invoice → stored QuickBooks id if available
3. mirrored invoice by amount/customer/date proximity if needed
4. only show QB button when a real customer-facing InvoiceLink exists
```

Important change: do not generate the internal `customerbalance` fallback URL anymore when no real QuickBooks payment link exists. That URL is not the real customer payment link and is causing confusion.

### 3. Add a clear “not synced yet” behavior
If Stripe exists but QuickBooks does not:
- keep Stripe button visible
- hide QuickBooks button
- optionally show a small status message in the editor like “QuickBooks payment link not available yet”

This avoids sending a broken/empty QB payment experience.

### 4. Ensure converted invoices can be matched to QuickBooks later
Review the ERP invoice creation/conversion flow and store a durable link for future lookup when available, such as:
- local invoice id ↔ QuickBooks invoice id
- or metadata on the sales invoice row once synced

That removes dependence on fuzzy `DocNumber` matching alone.

## Files to update
- `supabase/functions/quickbooks-oauth/index.ts`
- `src/components/accounting/documents/DraftInvoiceEditor.tsx`
- `supabase/functions/send-quote-email/index.ts`

## Expected result
After this change:
- QuickBooks payment links will appear only when a real QuickBooks `InvoiceLink` exists
- invoice emails can include both Stripe and QuickBooks links reliably
- users will no longer see “missing QB link” caused by empty mirrored data
- if QuickBooks has not produced a payment link yet, the UI will fail gracefully instead of pretending one exists

## Technical note
Current evidence strongly points to sync/data preservation, not rendering:
```text
accounting_mirror invoice rows exist
InvoiceLink is null for all checked rows
INV-20260001 has Stripe links, but no matching mirrored QuickBooks invoice/link
```
So the correct fix is to improve QuickBooks sync + lookup persistence, not just keep changing the email template.
