

# Maximize QuickBooks API Integration — Findings & Fix Plan

## Critical Finding: Why InvoiceLink Is Still Null

From the official QB API docs, `InvoiceLink` is defined as:

> "The link is generated only for invoices with **online payment enabled** and having a **valid customer email address**."

The app already sends `BillEmail` and uses `?include=invoiceLink` — but it **never sets the online payment flags**:

- `AllowOnlineCreditCardPayment: true`
- `AllowOnlineACHPayment: true`

Without these, QuickBooks will never generate an `InvoiceLink`, regardless of email or query params.

## Additional Gaps Found (from QB API docs)

| Gap | Current | Correct (per docs) |
|-----|---------|---------------------|
| Online payment flags | Not set | Must set `AllowOnlineCreditCardPayment` and `AllowOnlineACHPayment` to `true` |
| `GlobalTaxCalculation` | Not set | Required for non-US (Canadian) companies — should be `"TaxExcluded"` |
| `EmailStatus` | Not set | Should set to `"NeedToSend"` when email is provided, enabling QB's built-in send |
| QB Payments Charges API | Used in `stripe-payment` for Stripe, but also referenced in `usePaymentSources` | Charges API is **US-only** — should not call for Canadian companies |
| `ApplyTaxAfterDiscount` | Not set | Should be `false` (standard Canadian behavior — tax before discount) |
| Minor version | Not specified | Should use `minorVersion=69` or later for `InvoiceLink` (requires `>=36`) and `ProjectRef` support |

## Changes

### 1. `supabase/functions/quickbooks-oauth/index.ts` — Invoice creation payload

Add to the invoice `POST` payload in `handleCreateInvoice`:

```typescript
AllowOnlineCreditCardPayment: true,
AllowOnlineACHPayment: true,
GlobalTaxCalculation: "TaxExcluded",
```

This is the **primary fix** — without these flags, QB never generates the payment link.

### 2. Same file — `get-invoice-link` repair path

When the `get-invoice-link` action reads an existing invoice that has no `InvoiceLink` and the payment flags are `false`, do a sparse update to enable them:

```typescript
const updatePayload = {
  Id: invoice.Id,
  SyncToken: invoice.SyncToken,
  sparse: true,
  AllowOnlineCreditCardPayment: true,
  AllowOnlineACHPayment: true,
  ...(customerEmail && !invoice.BillEmail?.Address && { BillEmail: { Address: customerEmail } }),
};
```

Then re-read with `?include=invoiceLink` to get the newly generated link.

### 3. Same file — Add `minorversion` query param

Append `minorversion=69` to all `qbFetch` calls so QB returns `InvoiceLink` and `ProjectRef` fields. Update `qbFetch` to automatically append this:

```typescript
// In qbFetch, before building the URL:
const separator = path.includes("?") ? "&" : "?";
const versionedPath = path.includes("minorversion") ? path : `${path}${separator}minorversion=69`;
```

### 4. Same file — `GlobalTaxCalculation` for Canadian locale

Set `GlobalTaxCalculation: "TaxExcluded"` on all invoice creation payloads. This is required for non-US companies and prevents the tax calculation error 6000 that appeared earlier.

### 5. `src/hooks/usePaymentSources.ts` — Guard Charges API for Canadian accounts

The `list-charges` Stripe call is fine, but the QB Payments Charges API query should be skipped for Canadian companies. Currently there's no direct QB Charges call, but ensure we don't add one — the QB Payments Charges entity is explicitly **US-only**.

### 6. Same edge function — `handleCreateEstimate` and `handleConvertEstimateToInvoice`

Apply the same `AllowOnlineCreditCardPayment` and `AllowOnlineACHPayment` flags when converting estimates to invoices.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-oauth/index.ts` | Add online payment flags + `GlobalTaxCalculation` to invoice payloads; add `minorversion=69` to `qbFetch`; repair path in `get-invoice-link` to enable payment flags on existing invoices |

Single file change. No frontend or database changes needed.

## Expected Result

- New invoices will have `AllowOnlineCreditCardPayment: true` and `AllowOnlineACHPayment: true`
- QB will generate real `InvoiceLink` values (e.g., `https://intuit.me/...`)
- Existing invoices without links can be repaired via the `get-invoice-link` action
- Canadian tax handling works correctly with `GlobalTaxCalculation: "TaxExcluded"`
- `minorversion=69` ensures all modern QB API features are available

