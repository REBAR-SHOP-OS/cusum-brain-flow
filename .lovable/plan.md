

# QuickBooks Classic Accounting Parity -- Audit & Implementation Plan

## PHASE 1: Audit Report

### What Exists Now (Fully Implemented)

| Capability | Edge Function | UI Component | Status |
|---|---|---|---|
| Customer sync (two-way) | `quickbooks-oauth` (`update-customer`) | `AccountingCustomers` | Complete |
| Invoice create/update/void/send | `quickbooks-oauth` (4 actions) | `AccountingInvoices`, `InvoiceEditor` | Complete |
| Estimate create | `quickbooks-oauth` (`create-estimate`) | `CreateTransactionDialog`, `AccountingAccounts` | Complete |
| Estimate -> Invoice conversion | `quickbooks-oauth` (`convert-estimate-to-invoice`) | `AccountingAccounts` | Complete |
| Payment create (single + multi-invoice) | `quickbooks-oauth` (`create-payment`) | `CreateTransactionDialog` | Complete |
| Credit Memo create | `quickbooks-oauth` (`create-credit-memo`) | `CreateTransactionDialog` | Complete |
| Sales Receipt create/list | `quickbooks-oauth` | `AccountingSalesReceipts` | Complete |
| Refund Receipt create/list | `quickbooks-oauth` | `AccountingRefundReceipts` | Complete |
| Bill create + Bill Payment | `quickbooks-oauth` | `AccountingBills`, `BillPaymentDialog` | Complete |
| Deposit/Transfer/Journal Entry | `quickbooks-oauth` | Dedicated tabs | Complete |
| Purchase Order create | `quickbooks-oauth` | -- | Complete (API only) |
| Vendor create/update | `quickbooks-oauth` | `AccountingVendors`, `AddVendorDialog` | Complete |
| A/R Aging Report (30/60/90) | `quickbooks-oauth` (`get-aged-receivables`) | `AccountingAgedReceivables` | Complete |
| A/P Aging Report | `quickbooks-oauth` (`get-aged-payables`) | `AccountingAgedPayables` | Complete |
| P&L / Balance Sheet / GL / Trial Balance | `quickbooks-oauth` (4 actions) | `AccountingQBReport` | Complete |
| Cash Flow / Tax Summary | `quickbooks-oauth` | `AccountingCashFlow`, `TaxFilingSummary` | Complete |
| Customer Statement | `quickbooks-oauth` (`customer-statement`) | `AccountingStatements` | Complete (with local fallback) |
| Attachments | `quickbooks-oauth` (`upload-attachment`, `list-attachments`) | `AccountingAttachments`, `QBAttachmentUploader` | Complete |
| Webhook (inbound, HMAC verified, deduped) | `qb-webhook` | -- | Hardened |
| Sync Engine (incremental, locking, retries) | `qb-sync-engine` | -- | Hardened |
| Token refresh (proactive + reactive) | `quickbooks-oauth` | -- | Complete |
| Classes / Departments | `quickbooks-oauth` | `ClassDepartmentPicker` | Complete |
| Void vs Delete | `quickbooks-oauth` (separate actions) | Confirmation dialogs | Complete |
| Open/Paid/Overdue invoice views | -- | `AccountingInvoices` (filters + badges) | Complete |
| Quotation documents (PDF template) | -- | `QuotationTemplate`, `EstimationTemplate` | Complete |
| E-Signature on quotes | -- | `ESignatureDialog` | Complete |
| Budget vs Actuals | -- | `BudgetVsActuals`, `BudgetManagement` | Complete |
| Three-Way Matching | -- | `ThreeWayMatchingManager` | Complete |
| AR aging escalation (automated) | `ar-aging-escalation` | -- | Complete |

### What Is Missing

| Gap | Priority | Detail |
|---|---|---|
| **A) Audit trail logging** | **P0** | No `activity_events` entries for QB creates/updates/voids/payments. The accountant has no audit trail of who did what. |
| **B) Tax code / discount / shipping on line items** | **P1** | `create-invoice` and `create-estimate` payloads do not support `TaxCodeRef`, `DiscountLineDetail`, or shipping line items. The 13% HST is calculated client-side only. |
| **C) Invoice Terms (Net 15/30/60)** | **P1** | No `SalesTermRef` sent on invoice creation. QB defaults are used but not configurable per-company. |
| **D) Per-company QB configuration** | **P1** | No `qb_company_config` table for default income account, tax code, payment method mapping, invoice terms, numbering preference. |
| **E) Reconciliation issues table** | **P1** | No `qb_reconciliation_issues` table to track mismatched balances, missing invoices/payments, stale statuses. |
| **F) Payment idempotency** | **P1** | `create-payment` has no server-side dedupe. If called twice with the same invoice+amount+date, it creates a duplicate in QB. |
| **G) Estimate idempotency** | **P1** | `create-estimate` has no dedupe guard. |
| **H) Credit memo idempotency** | **P1** | `create-credit-memo` has no dedupe guard. |
| **I) CSV export for invoice/payment views** | **P2** | No export button on invoices or payments tables. |
| **J) Scheduled reconciliation job** | **P2** | No cron that pulls QB `LastUpdatedTime` changes and flags drift. |

---

## PHASE 2: Implementation Plan (P0 + P1)

### Migration 1: Audit Trail + Idempotency + Config Tables

```sql
-- 1) QB Company Config (per-company defaults)
CREATE TABLE IF NOT EXISTS public.qb_company_config (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id),
  default_income_account_id TEXT,
  default_tax_code TEXT DEFAULT 'TAX',
  default_payment_method TEXT,
  default_sales_term TEXT DEFAULT 'Net 30',
  use_qb_numbering BOOLEAN DEFAULT true,
  default_class_id TEXT,
  default_department_id TEXT,
  config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.qb_company_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access qb_company_config"
  ON public.qb_company_config FOR ALL USING (true) WITH CHECK (true);

-- 2) Reconciliation issues table
CREATE TABLE IF NOT EXISTS public.qb_reconciliation_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  issue_type TEXT NOT NULL, -- 'balance_mismatch', 'missing_invoice', 'missing_payment', 'stale_status'
  entity_type TEXT NOT NULL, -- 'Invoice', 'Payment', 'CreditMemo'
  entity_id TEXT,
  qb_value JSONB,
  erp_value JSONB,
  severity TEXT DEFAULT 'warning', -- 'info', 'warning', 'error'
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_qb_recon_company ON public.qb_reconciliation_issues(company_id, created_at DESC);
ALTER TABLE public.qb_reconciliation_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access qb_reconciliation_issues"
  ON public.qb_reconciliation_issues FOR ALL USING (true) WITH CHECK (true);
```

### Change 1: Audit Trail Logging in `quickbooks-oauth`

Add `activity_events` inserts after every successful QB write operation:

- `handleCreateInvoice` -> log `qb_invoice_created` with `{ docNumber, customerId, totalAmount, userId }`
- `handleCreateEstimate` -> log `qb_estimate_created`
- `handleCreatePayment` -> log `qb_payment_created`
- `handleCreateCreditMemo` -> log `qb_credit_memo_created`
- `handleVoidInvoice` -> log `qb_invoice_voided`
- `handleSendInvoice` -> log `qb_invoice_sent`
- `handleConvertEstimateToInvoice` -> log `qb_estimate_converted`
- `handleUpdateInvoice` -> log `qb_invoice_updated`

Each log entry will include `company_id`, `user_id`, `entity_type`, `entity_id`, and a JSONB snapshot. This gives the accountant a complete audit trail.

### Change 2: Payment Idempotency Guard

In `handleCreatePayment`, add a server-side dedupe check before calling QB:

```
-- Before creating payment, query qb_transactions for existing payment
-- with same company_id + customer QB ID + linked invoice ID + amount + date
-- If found, return existing payment instead of creating duplicate
```

This mirrors the existing `orderId` guard on `handleCreateInvoice`.

### Change 3: Tax Code + Terms Support on Invoice/Estimate Creation

Extend `handleCreateInvoice` and `handleCreateEstimate` payloads to accept:
- `taxCodeRef` (e.g., `"TAX"` or `"NON"`) added to each `SalesItemLineDetail`
- `salesTermRef` (e.g., `"3"` for Net 30) added to Invoice payload
- `discountPercent` or `discountAmount` as a `DiscountLineDetail` line
- `shippingAmount` as a separate line with `DetailType: "SalesItemLineDetail"` using the Shipping item

If not provided by the client, the edge function will look up `qb_company_config` for the company's defaults.

### Change 4: Per-Company Config Lookup

Add a helper `getCompanyQBConfig(supabase, companyId)` that fetches from `qb_company_config`. Used by invoice/estimate/payment creation to apply defaults when the client doesn't specify tax codes or terms.

### Change 5: CSV Export on Invoices & Payments

Add an "Export CSV" button to `AccountingInvoices` and `AccountingPayments` that exports the currently filtered data. Client-side only using the existing `@e965/xlsx` dependency.

---

## What Will NOT Change

- All existing UI workflows remain identical
- No QB objects will be removed or restructured
- No changes to webhook, sync engine, or token refresh logic (already hardened)
- No changes to existing DB tables (additive only)
- Existing `CreateTransactionDialog` continues to work as-is

## Deployment Order

1. Run DB migration (config table + reconciliation table)
2. Update `quickbooks-oauth` edge function (audit logging + idempotency + tax/terms)
3. Add CSV export buttons to `AccountingInvoices` and `AccountingPayments`
4. Deploy edge function

## Risk Level: Low

All changes are additive. Audit logging is fire-and-forget (wrapped in try/catch). Idempotency guards return existing data on duplicate calls. Tax/terms fields are optional with fallback to current behavior.

