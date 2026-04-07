

# Fix: QuickBooks Payment Link Returns Login Page Instead of Customer Payment URL

## Root Cause

The QuickBooks REST API **does not include `InvoiceLink`** in the response when creating an invoice via `POST /invoice`. The `InvoiceLink` (customer-facing payment URL) is only populated when you **read the invoice back** with a separate `GET /invoice/{id}` call after creation.

Current flow:
1. `POST /invoice` → creates invoice → response has `Id`, `DocNumber`, etc. but `InvoiceLink` is `null`
2. Code stores `null` as `invoiceLink`
3. Frontend gets `null` → shows "unavailable" or nothing

The previous "fallback" that built `https://app.qbo.intuit.com/app/invoice?txnId=...` was an admin-only URL (requires QB login) — which is what the user's screenshot shows.

## Fix

After creating the invoice, **read it back** to get the real `InvoiceLink`:

### `supabase/functions/quickbooks-oauth/index.ts`

After line 1537 (`const data = await qbFetch(config, "invoice", ...)`), add a read-back step:

```typescript
const createdInvoice = data.Invoice;

// QB doesn't return InvoiceLink on create — read it back
let invoiceWithLink = createdInvoice;
if (createdInvoice?.Id && !createdInvoice?.InvoiceLink) {
  try {
    const readBack = await qbFetch(config, `invoice/${createdInvoice.Id}`, {});
    if (readBack?.Invoice?.InvoiceLink) {
      invoiceWithLink = readBack.Invoice;
    }
  } catch (e) {
    console.warn("[create-invoice] Read-back for InvoiceLink failed:", e);
  }
}
```

Then replace all subsequent references to `createdInvoice` with `invoiceWithLink` (mirror upsert, response, audit).

This ensures the real customer payment URL (e.g., `https://intuit.me/...`) is returned and stored.

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/quickbooks-oauth/index.ts` | Add GET read-back after invoice creation to capture `InvoiceLink` |

Single file. No frontend changes needed — the frontend already correctly uses the returned `invoiceLink`.

