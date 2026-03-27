

# Fix: Invoice Line Items, Email Delivery, and QB Payment Link

## Three Issues

### 1. Line items not matching after acceptance
The `accept_and_convert` flow in `send-quote-email/index.ts` builds the invoice email's `lineItemsTable` from `quotes.metadata.line_items` (line 144-183). But the actual structured items live in `sales_quotation_items`. If `metadata.line_items` is empty or formatted differently, the email shows no items or wrong items — even though the code correctly copies items from `sales_quotation_items` to `sales_invoice_items` (lines 494-513).

**Fix**: After copying items to `sales_invoice_items`, rebuild the `lineItemsTable` HTML from the actual `sales_quotation_items` data (which was just fetched). This ensures the email matches the invoice exactly.

### 2. Invoice email not sent after acceptance
The `sendEmailDirectViaGmail` function silently returns `false` on Gmail token errors (invalid_grant). The user previously had this error. The email fails but acceptance still succeeds — so user sees "accepted" but no email arrives.

**Fix**: Already addressed in previous changes (the function logs the error). The Gmail token needs to be re-authorized. Additionally, improve error reporting — surface the email failure more clearly in the acceptance response so the user knows to re-send manually.

### 3. QB payment link not available when manually sending
The QB link lookup in `DraftInvoiceEditor.tsx` (line 370-383) queries `accounting_mirror` with `ilike("data->>DocNumber", invoiceNumber)`. Problems:
- The invoice may not be synced to QB yet
- The generated URL (`app.qbo.intuit.com/app/customerstatement?txnId=...`) is an internal QB URL, not a customer-facing payment link
- The `accept_and_convert` flow doesn't attempt a QB link at all

**Fix**: Instead of the internal QB URL, look up the existing Stripe payment link from `stripe_payment_links` table using the invoice ID. Also check by invoice number. The QB "payment link" concept doesn't have a customer-facing equivalent — QB Online's customer-facing invoice payment requires their own delivery mechanism. So focus on making the Stripe link reliably available.

## Changes

### A. `supabase/functions/send-quote-email/index.ts` — Rebuild line items from structured data

In the `accept_and_convert` section (after line 513, where items are copied), rebuild the email's line item HTML from the actual `sales_quotation_items` data instead of relying on `metadata.line_items`:

```text
After copying items to sales_invoice_items:
1. Use the fetched quoteItems (or metaItems fallback) to rebuild lineItemsHtml
2. Recalculate subtotal/tax from actual item totals
3. Rebuild lineItemsTable with proper formatting
4. This overrides the lineItemsTable built from metadata at the top
```

Also fix the Amount Due in the email — currently shows `amount` (pre-tax subtotal) but should show `rawTotalWithTax` (the tax-inclusive total the customer owes).

### B. `src/components/accounting/documents/DraftInvoiceEditor.tsx` — Fix QB payment link lookup

Replace the `accounting_mirror` lookup with a `stripe_payment_links` lookup by invoice ID or invoice number. This table is where Stripe links are actually stored. The current `accounting_mirror` approach is unreliable because:
- Not all invoices sync to QB
- The QB URL format is internal, not customer-facing

New lookup:
```typescript
const { data: existingLink } = await supabase
  .from("stripe_payment_links")
  .select("stripe_url")
  .or(`qb_invoice_id.eq.${invoiceId},invoice_number.eq.${invoiceNumber}`)
  .eq("status", "active")
  .maybeSingle();
if (existingLink?.stripe_url) {
  // Use existing link instead of creating a new one
}
```

Remove the QB-specific payment button (since QB doesn't have a customer-facing payment URL). Keep only the Stripe payment button.

### C. `supabase/functions/send-quote-email/index.ts` — Fix re-acceptance Stripe link lookup

The re-acceptance path (line 444-451) looks for a `payment_links` table which doesn't exist — it should be `stripe_payment_links`. Fix the table name.

## Technical Details

- The `amount` variable in `accept_and_convert` is the pre-tax subtotal (for storage), but the email "Amount Due" should show the full `rawTotalWithTax`
- Line item rebuild uses the same `quoteItems` array already fetched at line 495
- Stripe payment link lookup uses `stripe_payment_links.qb_invoice_id` which despite the name stores the invoice ID passed during creation

## Files Changed
- `supabase/functions/send-quote-email/index.ts` — rebuild line items from structured data for email, fix Amount Due, fix payment_links table name
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — replace accounting_mirror QB lookup with stripe_payment_links lookup, remove non-functional QB button

