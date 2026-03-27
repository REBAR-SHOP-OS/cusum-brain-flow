

# Fix: Invoice $0 After Quote Conversion + Add Send Email Button

## Two Issues

### Issue 1: Converted invoice shows $0 with empty line items
The `accept_and_convert` flow in `send-quote-email/index.ts` creates the invoice header with `amount` set correctly, but never copies line items into `sales_invoice_items`. The editor only reads from `sales_invoice_items` — if empty, it shows a blank row at $0.

**Fix (two-part):**

**A. `supabase/functions/send-quote-email/index.ts`** — After creating the invoice (line ~486), query the quotation's line items from `sales_quotation_items` (if that table exists) or parse `metadata.line_items` from the quotation, and insert them into `sales_invoice_items`.

**B. `src/components/accounting/documents/DraftInvoiceEditor.tsx`** — Fallback: if no `sales_invoice_items` exist but the invoice header has `amount > 0`, auto-populate a single line item with the total amount so existing converted invoices aren't empty.

### Issue 2: No "Send Email" button on invoice editor
The invoice editor has Save and Print/PDF but no way to email the invoice to the customer.

**Fix: `src/components/accounting/documents/DraftInvoiceEditor.tsx`** — Add a "Send Email" button in the top toolbar that:
- Calls `supabase.functions.invoke('gmail-send', ...)` with the invoice details
- Builds a branded HTML email with invoice summary and payment link (if available)
- Updates invoice status to "sent" after successful send
- Shows a simple email confirmation dialog (pre-filled with customer email from the invoice data)

## Files Changed
- `supabase/functions/send-quote-email/index.ts` — copy quotation line items to `sales_invoice_items` on accept
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — add fallback line item from header amount + add Send Email button

