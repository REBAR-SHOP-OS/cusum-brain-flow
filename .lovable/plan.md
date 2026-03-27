

# Fix: Invoice Email with Payment Links + Full Line Items

## Two Issues

### Issue 1: Invoice email from editor has no payment link
The `handleSendEmail` in `DraftInvoiceEditor.tsx` builds a plain HTML email with line items but includes no Stripe or QB payment link. It should:
- Call `stripe-payment` to generate a payment link before sending
- Include a "Pay Now" button in the email body

### Issue 2: Converted invoice shows "As per quotation" instead of actual line items
The fallback at line 134-141 of `DraftInvoiceEditor.tsx` shows a single "As per quotation" row when no `sales_invoice_items` exist. The line item copy logic in `send-quote-email` should work for new conversions, but existing invoices (INV-20260001 through 003) were created before the fix was deployed, so they still have no items.

**For existing invoices**: Remove the "As per quotation" fallback. Instead, when an invoice has `quotation_id`, fetch the quotation's line items from `sales_quotation_items` and populate the editor with them (and save them to `sales_invoice_items`).

## Changes

### 1. `src/components/accounting/documents/DraftInvoiceEditor.tsx`

**A. Fix fallback line items** (lines 134-141):
- When `loadedItems` is empty and invoice has a `quotation_id`, query `sales_quotation_items` for that quotation and use those as line items
- If no quotation items found either, parse `metadata.line_items` from the invoice
- Remove the generic "As per quotation" single-row fallback

**B. Enhance email sending** (lines 267-315):
- Before sending, call `stripe-payment` edge function with `action: "create-payment-link"` to generate a Stripe payment link
- Include a styled "Pay Now" button in the email HTML linking to the Stripe URL
- Include proper line item table with subtotal, HST, and total (matching the quotation email format)
- Add branded email wrapper matching the `send-quote-email` style

### 2. No edge function changes needed
The `stripe-payment` function already supports `create-payment-link`. The invoice editor will call it directly from the frontend before composing the email.

## Technical Details

```text
Email send flow:
1. User clicks "Send Email" → email dialog opens
2. User confirms → handleSendEmail fires
3. Call stripe-payment to get payment link URL
4. Build branded HTML with line items table + Pay Now button
5. Call gmail-send with the HTML
6. Update invoice status to "sent"
```

## Files Changed
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — fix line item fallback from quotation, add payment link to email

