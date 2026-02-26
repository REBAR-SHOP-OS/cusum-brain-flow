

# QuickBooks Classic Accounting Parity -- Audit & Implementation Plan

## STATUS: ✅ IMPLEMENTED

### Completed Changes

| Change | Status | Detail |
|---|---|---|
| **DB: `qb_company_config` table** | ✅ Done | Per-company defaults for tax code, sales term, income account, class, department |
| **DB: `qb_reconciliation_issues` table** | ✅ Done | Tracks balance mismatches, missing invoices/payments, stale statuses |
| **DB: `dedupe_key` on `qb_transactions`** | ✅ Done | Indexed column for server-side idempotency guards |
| **Audit trail logging** | ✅ Done | All QB write operations log to `activity_events` (create/update/void/send/convert/delete) |
| **Payment idempotency** | ✅ Done | Server-side dedupe via `dedupe_key` in `qb_transactions` before QB API call |
| **Estimate idempotency** | ✅ Done | Same dedupe pattern as payments |
| **Credit memo idempotency** | ✅ Done | Same dedupe pattern as payments |
| **Tax code support** | ✅ Done | `TaxCodeRef` on invoice/estimate line items, defaults from `qb_company_config` |
| **Invoice terms support** | ✅ Done | `SalesTermRef` on invoices, defaults from `qb_company_config` |
| **Discount/shipping lines** | ✅ Done | Optional `discountPercent` and `shippingAmount` on invoice creation |
| **Per-company config lookup** | ✅ Done | `getCompanyQBConfig()` helper fetches defaults from `qb_company_config` |
| **CSV export (Invoices)** | ✅ Done | "Export CSV" button on `AccountingInvoices` |
| **CSV export (Payments)** | ✅ Done | "Export CSV" button on `AccountingPayments` |

### Audit Events Logged

| Handler | Event Type |
|---|---|
| `handleCreateInvoice` | `qb_invoice_created` |
| `handleCreateEstimate` | `qb_estimate_created` |
| `handleCreatePayment` | `qb_payment_created` |
| `handleCreateCreditMemo` | `qb_credit_memo_created` |
| `handleVoidInvoice` | `qb_invoice_voided` |
| `handleSendInvoice` | `qb_invoice_sent` |
| `handleConvertEstimateToInvoice` | `qb_estimate_converted` |
| `handleUpdateInvoice` | `qb_invoice_updated` |
| `handleDeleteTransaction` | `qb_transaction_deleted` |
| `handleVoidTransaction` | `qb_transaction_voided` |

### What Did NOT Change

- All existing UI workflows remain identical
- No QB objects removed or restructured
- No changes to webhook, sync engine, or token refresh logic
- No changes to existing DB table structures (additive only)
- `CreateTransactionDialog` continues to work as-is

### Risk Level: Low

All changes are additive. Audit logging is fire-and-forget (try/catch). Idempotency guards return existing data on duplicate calls. Tax/terms fields are optional with fallback to current behavior.
