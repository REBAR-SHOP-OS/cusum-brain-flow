

# Fix: Double Tax on Converted Invoice + Missing Line Items + Add QB Link

## Problems Found

### 1. Double taxation
The quotation total (`$107,194.20`) already includes 13% HST. When the `accept_and_convert` flow creates the invoice, it stores this tax-inclusive amount as `amount`. The invoice editor then treats line item unit prices as pre-tax and adds HST **again**, inflating the total.

**Root cause in `send-quote-email/index.ts` (line 420):**
```
const amount = sqCheck?.amount || totalAmount;  // $107,194.20 (tax-inclusive)
```
This is stored as the invoice `amount`. The editor fallback (line 181-183) creates `unitPrice = inv.amount` ($107,194.20), then the editor adds 13% HST on top → $121,129.45.

### 2. Line items missing — shows "Invoice total" instead of actual items
The fallback chain fails to find quotation items (likely a table/data mismatch), falling through to the last resort: a single "Invoice total" row with the full amount.

### 3. No QuickBooks payment link in email
The Send Email flow only generates a Stripe payment link. User wants QB payment link included too.

## Fix

### A. `supabase/functions/send-quote-email/index.ts` — Store subtotal, not total

In `accept_and_convert` (line 420), **back-calculate the pre-tax subtotal** from the quotation total when creating the invoice. Store the subtotal as `amount` so the editor can correctly add HST:

```
// Before: amount = sqCheck?.amount || totalAmount (tax-inclusive!)
// After: store PRE-TAX subtotal
const taxRate = (meta.tax_rate ?? 13) / 100;
const rawAmount = sqCheck?.amount || totalAmount;
const invoiceSubtotal = Math.round((rawAmount / (1 + taxRate)) * 100) / 100;
```

Use `invoiceSubtotal` for the invoice `amount` field. Also use `invoiceSubtotal` for the Stripe payment link amount (Stripe should charge the full tax-inclusive total, so pass `rawAmount` to Stripe instead).

### B. `src/components/accounting/documents/DraftInvoiceEditor.tsx` — Fix line item loading

**Problem**: When quotation items exist in `sales_quotation_items`, they have `unit_price` as pre-tax values. But the fallback "Invoice total" row uses the tax-inclusive total as `unitPrice`. 

**Fix the fallback** (line 181-183): When creating the "Invoice total" fallback line, back-calculate the pre-tax amount:
```typescript
const preTax = Number(inv.amount) / (1 + taxRate / 100);
setItems([{ description: "Invoice total", quantity: 1, unitPrice: Math.round(preTax * 100) / 100 }]);
```

But better: ensure the quotation item fetch works. Check if the `quotation_id` is being matched correctly.

### C. `src/components/accounting/documents/DraftInvoiceEditor.tsx` — Add QB payment link to email

In `handleSendEmail`, after the Stripe payment link lookup, also check `stripe_payment_links` table for any QuickBooks-related link. If found, include a second "Pay via QuickBooks" button in the email HTML alongside the Stripe button.

Alternatively — since there's no separate QB payment link system — include both payment options if available from the `stripe_payment_links` table (which stores the QB invoice ID mapping).

## Technical Details

### Invoice amount storage convention (going forward)
- `sales_invoices.amount` = **pre-tax subtotal** (line items sum)
- Editor adds HST on display
- Stripe payment link = **total with tax**

### Line item restoration priority
1. `sales_invoice_items` (persisted)
2. `sales_quotation_items` via `quotation_id` (copy + persist)
3. `metadata.line_items` (parse + display)
4. Single row from `amount` (back-calculate pre-tax) — last resort

## Files Changed
- `supabase/functions/send-quote-email/index.ts` — store pre-tax subtotal as invoice amount, pass full total to Stripe
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — fix "Invoice total" fallback to use pre-tax amount; add QB payment link to email

