
# QuickBooks Integration Audit — Completed

## Changes Applied (based on official QB API docs)

### 1. InvoiceLink Generation — FIXED
- Added `AllowOnlineCreditCardPayment: true` and `AllowOnlineACHPayment: true` to all invoice creation payloads
- Added `?include=invoiceLink` read-back after creation
- `get-invoice-link` action now repairs existing invoices that lack payment flags via sparse update
- `minorversion=69` auto-appended to ALL QB API calls (both `quickbooks-oauth/index.ts` and shared `qbClient.ts`)

### 2. Canadian Tax Compliance — FIXED
- `GlobalTaxCalculation: "TaxExcluded"` added to: invoices, estimates, sales receipts, refund receipts, estimate-to-invoice conversion
- `ApplyTaxAfterDiscount: false` added to invoices and estimates (standard Canadian behavior)

### 3. Customer Sync — ENHANCED
- Now pulls `email`, `phone`, `address`, `city`, `province`, `postal_code` from QB during sync
- Previously only synced `name`, `company_name`, `notes`, `credit_limit`, `payment_terms`, `status`

### 4. Query Escaping — FIXED
- `handleCreateCustomer` used `\'` (backslash) for single-quote escaping — changed to `''` (double single-quote) per QB QDSL spec

### 5. Email Flow — ENHANCED
- `EmailStatus: "NeedToSend"` set when `BillEmail` is provided on invoices
- QB's built-in email delivery is now enabled automatically

### 6. New Actions Added
- `read-invoice` — Read a single invoice by ID with `?include=invoiceLink`
- `get-invoice-pdf` — Fetch invoice PDF as base64
- `update-estimate` — Sparse update an estimate

### 7. Estimate-to-Invoice Conversion — ENHANCED
- Now carries forward `BillEmail` from estimate
- Adds `AllowOnlineCreditCardPayment`, `AllowOnlineACHPayment`, `GlobalTaxCalculation`

### 8. QB Payments Charges API — Verified
- Confirmed US-only — no Canadian-side calls exist (correct)

## Files Changed
- `supabase/functions/quickbooks-oauth/index.ts`
- `supabase/functions/_shared/qbClient.ts`
