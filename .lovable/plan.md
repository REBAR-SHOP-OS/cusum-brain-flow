

# Fix: Invoice Line Items Not Copied + Customer Email Not Mapped

## Root Causes Found

### BUG 1: `sales_invoices` table has NO `metadata` column
The edge function (`send-quote-email`) inserts `metadata: { source_quote_id, source_quote_number, line_items }` into `sales_invoices` — but the column doesn't exist in the database. This causes the entire invoice INSERT to fail for new acceptances, meaning no invoice is created and no items can be copied.

**Evidence:** `sales_invoices` columns are: id, company_id, invoice_number, customer_name, customer_company, quotation_id, sales_lead_id, amount, status, due_date, issued_date, notes, created_at, paid_date, payment_method. No `metadata` column.

### BUG 2: `sales_quotations` has NO `customer_email` column
The edge function reads `sqCheck.customer_email` (line 553), but `sales_quotations` has no such column. This means the email resolution chain `customer_email || meta.customer_email || sqCheck.customer_email` can't find the email from the quotation record.

**Evidence:** Schema check confirms no `customer_email` on `sales_quotations`.

### BUG 3: No matching `sales_quotation` for quote QAI-2587
The edge function looks up `sales_quotations` by `quotation_number = 'QAI-2587'` but zero rows match. This means `sqCheck` is null, so `quotation_id` on the invoice is set to null, and the fallback chain in the editor can't trace back to the source quote.

### BUG 4: DraftInvoiceEditor doesn't resolve customer email from `customers` table
The editor reads `customerEmail` from `inv.metadata.customer_email` — but since `metadata` column doesn't exist, it's always empty. The editor should look up the customer's email from the `customers` table by matching `customer_name`.

### BUG 5: Existing invoice INV-20260001 has `quotation_id = null` and 0 line items
This invoice exists but was never linked to its source quote, and items were never copied (likely due to the metadata column failure).

## Fixes

### Fix 1: Database migration — add missing columns
Add `metadata jsonb default '{}'::jsonb` to `sales_invoices`.
Add `customer_email text` to `sales_invoices`.
Add `customer_email text` to `sales_quotations`.

### Fix 2: Database data fix — link existing invoice to its quote
Update `INV-20260001` to set `customer_email = 'sattar@rebar.shop'`.
Insert the 2 line items from quote QAI-2587 into `sales_invoice_items`.
Create a `sales_quotations` entry for QAI-2587 if missing (so future lookups work).

### Fix 3: DraftInvoiceEditor — resolve customer email from `customers` table
After loading the invoice, look up the customer by name in the `customers` table and use their `email` field. This ensures the "Send Email" button has a valid recipient.

### Fix 4: Edge function — store `customer_email` on invoice creation
In `send-quote-email/index.ts`, when creating the invoice, also set the new `customer_email` column with the resolved email address.

## Files Changed
- **Database migration** — add `metadata`, `customer_email` columns to `sales_invoices`; add `customer_email` to `sales_quotations`
- **Database insert** — fix existing INV-20260001 data (link items, set email)
- **`src/components/accounting/documents/DraftInvoiceEditor.tsx`** — resolve customer email from `customers` table
- **`supabase/functions/send-quote-email/index.ts`** — persist `customer_email` on invoice

