
# Root-cause fix for “still no link returned”

## What I found
The `?include=invoiceLink` fix is already present in the backend, so the current problem is no longer the missing query param.

The real blockers are:

1. **Invoices are being created in QuickBooks without an email**
   - In recent mirrored QuickBooks invoices, `InvoiceLink = null`
   - `BillEmail = null`
   - online payment flags are partially on, but there is still no public link
   - This means the invoice is not being created with the customer email data needed for the payment-link flow

2. **The frontend is accidentally creating duplicate QuickBooks invoices**
   - `DraftInvoiceEditor.tsx` calls `create-invoice` just to:
     - pre-check link availability when opening email dialog
     - get a link before sending email
     - get a link from the “Get QuickBooks Link” button
   - Those are write actions, not read actions
   - This is why multiple orphan QB invoices are being created for the same invoice flow

3. **Customer email is not being carried through the QB creation path**
   - `handleCreateInvoice` accepts customer name/items, but not a proper `customerEmail`
   - when a QB customer is auto-created, it is created with `DisplayName` only
   - the invoice payload also does not set `BillEmail`

4. **The invoice editor is not persisting the invoice email strongly enough**
   - `sales_invoices.customer_email` is available, but save flow is not updating it
   - so later QB pushes do not reliably have the email they need

## Evidence
- Latest ERP invoice has `qb_invoice_id` but `qb_invoice_link = null`
- Recent mirrored QB invoices have:
  - `InvoiceLink = null`
  - `BillEmail = null`
- Local customer record has an email, but no `quickbooks_id`, so the code falls into “search/create QB customer” and currently creates that QB customer without email

## Fix plan

### 1) Stop creating QB invoices from read-only UI checks
Update `src/components/accounting/documents/DraftInvoiceEditor.tsx` so:
- opening the email dialog does **not** call `create-invoice`
- “Get QuickBooks Link” first checks:
  - stored `metadata.qb_invoice_link`
  - stored `metadata.qb_invoice_id`
  - mirror data
- only create a QB invoice **once** if none exists
- if a QB invoice already exists, fetch/read that invoice instead of creating another

### 2) Add a read-only QB invoice fetch path
Update `supabase/functions/quickbooks-oauth/index.ts` to add a read action such as:
- `get-invoice-link` or `get-invoice`
- fetch by QB invoice id using `?include=invoiceLink`
- return `InvoiceLink`, `BillEmail`, payment flags, and invoice id

This gives the UI a safe way to refresh the link without creating duplicates.

### 3) Pass and persist customer email end-to-end
Update `DraftInvoiceEditor.tsx` so QB calls include `customerEmail`, and save flow persists:
- `sales_invoices.customer_email`
- optionally mirror it into metadata fallback as well

### 4) Create/update the QB customer with email
Update `handleCreateInvoice` in `supabase/functions/quickbooks-oauth/index.ts` so:
- request body accepts `customerEmail`
- if the QB customer is auto-created, include `PrimaryEmailAddr`
- if an existing QB customer is found but has no email and we have one locally, update that customer email before invoicing

### 5) Set invoice email explicitly on the QB invoice
When building the QB invoice payload, include:
- `BillEmail: { Address: customerEmail }` when available

Then keep the existing read-back:
- `invoice/{id}?include=invoiceLink`

This is the core backend change that should allow the public payment link to exist.

### 6) Repair existing invoices instead of creating more
For invoices that already have `qb_invoice_id` but no link:
- fetch the existing QB invoice by id
- if it has no `BillEmail`, update the invoice/customer email path
- re-read with `?include=invoiceLink`
- persist `qb_invoice_link` back to `sales_invoices.metadata`

### 7) Validate after fix
I would verify all of these:

- opening the email dialog creates **zero** new QB invoices
- clicking “Get QuickBooks Link” on an invoice with existing `qb_invoice_id` does **not** create a duplicate
- returned QB invoice now has:
  - `BillEmail.Address`
  - non-null `InvoiceLink`
- `sales_invoices.metadata.qb_invoice_link` is saved
- UI opens the real customer link (`intuit.me/...`), not sign-in

## Files to change
- `supabase/functions/quickbooks-oauth/index.ts`
- `src/components/accounting/documents/DraftInvoiceEditor.tsx`

## Important note
There is one possible environment check to keep in scope:
- if this QuickBooks connection is still running in **sandbox**, public payment-link behavior can still be limited/inconsistent
- but the code-level root issue is already clear: **we are creating invoices without email and using a write endpoint where a read endpoint is needed**

## Expected result
After this fix:
- no more duplicate QB invoices from UI checks
- existing invoices reuse stored QB ids
- QB invoices are created with email
- read-back returns a real public payment link
- the button opens the customer payment page instead of showing “No link returned”
