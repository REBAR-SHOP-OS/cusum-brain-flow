

# Phase 17: Maximize QuickBooks Integration

## Current Coverage Assessment

The existing QuickBooks integration is already extensive, covering:
- **OAuth + Token Management** with proactive refresh and rate-limit retry
- **Full Sync Engine** (backfill, incremental, CDC deletion detection, reconciliation)
- **GL Normalization** -- all QB transactions mapped to double-entry GL lines
- **Transaction CRUD** -- Invoice, Estimate, Bill, Payment, CreditMemo, PurchaseOrder, SalesReceipt, RefundReceipt, Deposit, Transfer, JournalEntry
- **Reports** -- P&L, Balance Sheet, Aged AR/AP, General Ledger, Trial Balance, Transaction List
- **Payroll** -- Employee list/get/update, TimeActivity list, payroll corrections via JE
- **Banking** -- Bank activity sync with live balances, unreconciled counts, reconciled-through dates
- **Recurring Transactions** -- List via query (UI exists)
- **Expenses/Purchases** -- List via query (UI exists)
- **AI Audit** -- Gemini-powered forensic analysis of QB data
- **Auto-Reconciliation** -- 100% confidence matching engine
- **Orphan Invoice Relinking** -- Auto-match invoices to CRM customers

## What's Missing (Unused QB APIs)

### Track 1: Cash Flow Statement Report
QuickBooks provides a native `reports/CashFlow` endpoint. Currently cash flow is "derived" (per memory). Using the real QB report ensures accuracy.

**Deliverables:**
- Add `get-cash-flow` action to `quickbooks-oauth`
- New `AccountingCashFlow.tsx` component with period comparison (this month vs last month)
- Add to AccountingWorkspace tabs

### Track 2: Bill Payments (VendorCredit already synced, BillPayment is not)
The `BillPayment` entity allows paying bills -- currently bills exist but paying them through the ERP creates journal entries rather than proper QB BillPayments.

**Deliverables:**
- Add `create-bill-payment` and `list-bill-payments` actions to `quickbooks-oauth`
- Add BillPayment to `TXN_TYPES` in `qb-sync-engine` for full sync
- Wire into VendorDetail "Make Payment" button

### Track 3: Attachments API
QB's `Attachable` endpoint lets you attach PDFs/images to invoices, bills, and receipts. Currently no file attachment sync exists.

**Deliverables:**
- Add `upload-attachment` and `list-attachments` actions to `quickbooks-oauth`
- New `QBAttachmentUploader` component for InvoiceEditor and VendorDetail
- Auto-attach packing slip PDFs to invoices when generated

### Track 4: Customer/Vendor Update (Write-Back)
Currently customers/vendors sync one-way (QB to ERP). Edits in the ERP don't push back.

**Deliverables:**
- Add `update-customer` and `update-vendor` actions to `quickbooks-oauth`
- Wire "Save" in customer/vendor detail views to push changes to QB
- Two-way sync indicator in UI

### Track 5: Tax Summary Report + HST Filing Support
QB's `reports/TaxSummary` provides tax collected/paid breakdown for HST/GST filing.

**Deliverables:**
- Add `get-tax-summary` action to `quickbooks-oauth`
- New `TaxFilingSummary.tsx` component showing HST collected, ITC claimed, net owing
- Add to the existing `TaxPlanning.tsx` tab

### Track 6: Class & Department Tracking
QB supports `Class` and `Department` entities for cost-center tracking. This enables project-level and department-level P&L.

**Deliverables:**
- Add `list-classes`, `list-departments`, `create-class` actions
- Sync classes/departments in `qb-sync-engine` backfill
- Add Class/Department selector to transaction creation dialogs (Invoice, Bill, JE)
- Enable `reports/ProfitAndLoss?summarize_column_by=Class` for project-level reporting

### Track 7: Webhooks (Real-Time Push Notifications)
Instead of polling with incremental sync, QB Webhooks push changes in real-time.

**Deliverables:**
- New edge function `qb-webhook` to receive QB webhook events
- Register webhook URL via QB Developer Portal
- On webhook event: trigger incremental sync for the changed entity
- Eliminates sync delay -- changes appear in seconds vs next cron cycle

### Track 8: Purchase (Expense) Creation
Expenses/Purchases can be listed but not created from the ERP.

**Deliverables:**
- Add `create-purchase` action to `quickbooks-oauth`
- New `CreateExpenseDialog` component
- Wire into AccountingExpenses tab

---

## Technical Details

### Edge Function Changes

**`quickbooks-oauth/index.ts`** -- Add 10 new action handlers:
- `get-cash-flow` -- fetch `reports/CashFlow` with date range
- `create-bill-payment` -- POST to `billpayment` endpoint
- `list-bill-payments` -- query BillPayment entity
- `upload-attachment` -- multipart POST to `upload` endpoint
- `list-attachments` -- query Attachable by entity ref
- `update-customer` -- sparse update to `customer` endpoint
- `update-vendor` -- sparse update to `vendor` endpoint
- `get-tax-summary` -- fetch `reports/TaxSummary`
- `list-classes` / `create-class` -- query/create Class entities
- `list-departments` -- query Department entities
- `create-purchase` -- POST to `purchase` endpoint

**`qb-sync-engine/index.ts`** -- Extend sync:
- Add `BillPayment` to `TXN_TYPES` array
- Add Class and Department upsert functions (new `qb_classes` and `qb_departments` tables)
- Sync attachable metadata during backfill

**New `qb-webhook/index.ts`** -- Webhook receiver:
- Validate webhook signature using QB's verifier token
- Parse notification payload for entity type and ID
- Trigger targeted sync for changed entities

### Database Migration
- `qb_classes` table (id, company_id, qb_id, name, parent_qb_id, is_active, raw_json, last_synced_at) with RLS
- `qb_departments` table (id, company_id, qb_id, name, is_active, raw_json, last_synced_at) with RLS
- Add `class_qb_id` and `department_qb_id` nullable columns to `qb_transactions`
- Add `qb_webhook_events` table for audit logging of incoming webhooks

### New Frontend Components (6)
- `src/components/accounting/AccountingCashFlow.tsx` -- Cash flow statement with period comparison
- `src/components/accounting/TaxFilingSummary.tsx` -- HST/GST filing report
- `src/components/accounting/QBAttachmentUploader.tsx` -- File upload to QB entities
- `src/components/accounting/CreateExpenseDialog.tsx` -- New expense/purchase dialog
- `src/components/accounting/ClassDepartmentPicker.tsx` -- Reusable picker for transactions
- `src/components/accounting/BillPaymentDialog.tsx` -- Pay bills with proper QB BillPayment

### Modified Frontend Files (6-8)
- `AccountingWorkspace.tsx` -- Add Cash Flow and Tax Filing tabs
- `VendorDetail.tsx` -- Wire "Make Payment" to new BillPaymentDialog
- `InvoiceEditor.tsx` -- Add attachment upload, class/department pickers
- `CreateVendorTransactionDialog.tsx` -- Add class/department pickers
- `AccountingExpenses.tsx` -- Add "New Expense" button
- `AccountingDashboard.tsx` -- Add cash flow widget

### Implementation Order
1. Database migration (qb_classes, qb_departments, webhook events)
2. Track 1: Cash Flow report (quick win, high value)
3. Track 2: Bill Payments (fixes vendor payment gap)
4. Track 5: Tax Summary (compliance value)
5. Track 4: Customer/Vendor write-back (two-way sync)
6. Track 6: Class/Department tracking (project-level P&L)
7. Track 8: Expense creation
8. Track 3: Attachments API
9. Track 7: Webhooks (infrastructure upgrade)

