

# Fix: QuickBooks Link Goes to QB Login Instead of Customer Payment Page

## Problem
The QuickBooks payment link on invoices uses fallback URLs like `https://app.qbo.intuit.com/app/invoice?txnId=XXX` — this is the **admin dashboard URL** that requires a QuickBooks login. Customers clicking this link see a login page, not a payment form.

The correct customer-facing link is the `InvoiceLink` value returned by the QuickBooks API (e.g., `https://qbo.intuit.com/payment/...`), but when that's not available, the code falls back to the admin URL.

## Root Cause
Three places construct fallback admin URLs when `InvoiceLink` is missing:
- **Line 300**: `https://app.qbo.intuit.com/app/invoice?txnId=${qb_invoice_id}` — on invoice load
- **Line 1258**: Same pattern — on "Get QB Link" button click
- **PaymentLinksSection.tsx line 26**: `https://app.qbo.intuit.com/app/customerbalance?invoiceId=...`

## Fix

### 1. `DraftInvoiceEditor.tsx` — Remove admin URL fallbacks

**Line 299-301** (invoice load): Only set `qbPayUrl` when a real `qb_invoice_link` exists in metadata. Remove the `qb_invoice_id` fallback that builds an admin URL.

**Line 1258**: When the "Get QB Link" button returns no `InvoiceLink`, don't fall back to the admin URL. Instead show a message like "No customer payment link available — push invoice to QB first."

### 2. `PaymentLinksSection.tsx` — Remove admin URL fallback

**Line 26**: Only use `invoiceLink` if it exists. Don't fall back to `app.qbo.intuit.com` admin URL.

### 3. Show "Generate" button when no link exists

When `qbPayUrl` is null, the existing "Push to QB" button already handles creating the invoice and retrieving the `InvoiceLink`. No additional logic needed — just stop showing broken admin links.

## Files Changed
| File | Change |
|------|--------|
| `src/components/accounting/documents/DraftInvoiceEditor.tsx` | Remove 2 admin-URL fallbacks (lines 300, 1258) |
| `src/components/accounting/PaymentLinksSection.tsx` | Remove admin-URL fallback (line 26) |

