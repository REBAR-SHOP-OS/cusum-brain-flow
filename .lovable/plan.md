

# QuickBooks Payment Link Visibility + Stripe Test Mode

## Two Issues

### 1. QuickBooks Payment Link Not Showing
The QB payment link section (line 1223) is wrapped in `{qbPayUrl && ...}`, so it only shows when `qbPayUrl` is set. The data loading at line 297 reads from `metadata.qb_invoice_link`, but many invoices don't have this populated (the QB sync may not have stored the link, or the invoice was created before this feature). The QB link should always be available — either from metadata or generated on-the-fly from the QB invoice ID.

**Fix**: Show the QB payment button always. If `qbPayUrl` is empty but `qb_invoice_id` exists in metadata, construct the QB payment URL from the invoice ID. If neither exists, show a "Sync to QuickBooks" button that triggers the QB push and retrieves the link.

### 2. Stripe in Test Mode
Stripe shows "TEST MODE" because the `STRIPE_SECRET_KEY` secret is set to a **test key** (`sk_test_...`). This is not a code issue — it's a configuration issue. You need to replace it with your **live secret key** (`sk_live_...`) from the Stripe Dashboard → Developers → API Keys.

**Action**: Update the `STRIPE_SECRET_KEY` secret to your live key when ready to accept real payments.

## Changes

### `src/components/accounting/documents/DraftInvoiceEditor.tsx`

1. **Always show QB payment section** — remove the `qbPayUrl &&` guard on line 1223
2. **Fallback QB URL**: If `qbPayUrl` is empty but `metadata.qb_invoice_id` exists, construct URL as `https://app.qbo.intuit.com/app/invoice?txnId={qb_invoice_id}`
3. **"Get QB Link" button**: If no QB URL and no QB invoice ID, show a button that pushes the invoice to QB (reusing existing `push-to-qb` flow) and captures the returned `InvoiceLink`

### Secret Update (manual)
Replace `STRIPE_SECRET_KEY` from `sk_test_...` to `sk_live_...` when ready for production payments.

## Files
| File | Change |
|------|--------|
| `src/components/accounting/documents/DraftInvoiceEditor.tsx` | Always show QB link section with fallback URL construction |
| Secret: `STRIPE_SECRET_KEY` | User must update to live key |

