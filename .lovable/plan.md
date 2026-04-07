

# Fix: QuickBooks InvoiceLink Not Returned — Missing `?include=invoiceLink` Parameter

## Root Cause

The QuickBooks API **no longer returns `InvoiceLink` by default** on GET requests. As of a QB API update (documented in [intuit/QuickBooks-V3-PHP-SDK#276](https://github.com/intuit/QuickBooks-V3-PHP-SDK/issues/276)), you must explicitly pass the query parameter `?include=invoiceLink` on the GET call.

Current read-back code (line 1544):
```
qbFetch(config, `invoice/${createdInvoice.Id}`, {})
```
This hits: `.../v3/company/{realm}/invoice/{id}` — **no `include` param** → `InvoiceLink` is always `null`.

The app also has `com.intuit.quickbooks.payment` scope enabled (confirmed in the uploaded screenshot), so the QB account supports online payments. The link just isn't being requested properly.

## Fix

### `supabase/functions/quickbooks-oauth/index.ts`

**Line 1544** — Append `?include=invoiceLink` to the read-back path:

```typescript
// Before:
const readBack = await qbFetch(config, `invoice/${createdInvoice.Id}`, {});

// After:
const readBack = await qbFetch(config, `invoice/${createdInvoice.Id}?include=invoiceLink`, {});
```

**Also fix all other places** where invoices are fetched by ID without `include=invoiceLink`:
- Search for any other `qbFetch(config, \`invoice/` calls and add the same parameter
- The sync/mirror flow that reads invoices should also include this parameter so stored mirror data has the link

### Scope of change
Single file: `supabase/functions/quickbooks-oauth/index.ts` — add `?include=invoiceLink` to all invoice GET calls.

No frontend changes needed. The frontend already correctly uses whatever `InvoiceLink` value is returned.

