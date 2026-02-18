
# QuickBooks vs ERP: Complete Feature Gap Analysis

## Summary

After a deep audit of every edge function action, UI component, hook, and navigation menu in the ERP's Accounting module, here is the full apple-to-apple comparison against QuickBooks Online (Plus/Advanced).

---

## WHAT YOU ALREADY HAVE (Covered)

| QB Feature | ERP Status |
|---|---|
| Invoices (list, create, edit, send, void, delete) | DONE |
| Estimates/Quotations (list, create, convert to invoice) | DONE |
| Bills (list, create) | DONE |
| Payments received (list, create) | DONE |
| Vendor Payments / Bill Payments (list) | DONE |
| Credit Memos (list, create) | DONE |
| Purchase Orders (list, create) | DONE |
| Customer management (list, detail, 30+ fields) | DONE |
| Vendor management (list, detail, 30+ fields, 1099) | DONE |
| Chart of Accounts (full tree, create, sub-accounts) | DONE |
| Items / Products & Services (list, create) | DONE |
| Balance Sheet report | DONE |
| Profit & Loss report | DONE |
| Cash Flow Statement (derived) | DONE |
| Payroll corrections (Journal Entry) | DONE |
| Employee list + detail | DONE |
| Time Activities list | DONE |
| AI Audit (forensic analysis) | DONE |
| Bank Balance (manual entry) | DONE |
| Trial Balance check + posting hard-stop | DONE |
| Full sync / incremental sync / reconciliation | DONE |
| ERP mirror tables (qb_transactions, qb_accounts, etc.) | DONE |

---

## WHAT IS MISSING (Gaps)

### TIER 1 -- Core Transaction Types (QB has them, ERP does not)

| # | QB Feature | What It Does | Impact |
|---|---|---|---|
| 1 | **Sales Receipts** | Payment collected at point of sale (no invoice needed). Separate entity in QB. | Cannot record cash/walk-in sales |
| 2 | **Refund Receipts** | Refund issued to customer for returned goods/overpayment | No refund workflow |
| 3 | **Deposits** | Record bank deposits, group multiple payments into one deposit | Cannot match bank deposits |
| 4 | **Bank Transfers** | Move money between bank accounts (e.g., checking to savings) | Must do this in QB directly |
| 5 | **Journal Entries (General)** | Standalone journal entries for adjustments (only payroll correction exists) | No ad-hoc adjustments in ERP |
| 6 | **Expenses** | Direct expense recording (check, cash, credit card charge) -- separate from Bills | Only "create-bill" exists; Expense/Cheque map to the same endpoint |
| 7 | **Delayed Charges** | Unbilled charges accumulated before invoicing | No deferred billing |
| 8 | **Delayed Credits** | Unbilled credits to offset future invoices | No deferred credits |
| 9 | **Vendor Credits (standalone list)** | Create standalone vendor credit (SupplierCredit maps to create-bill currently) | Limited; no dedicated view |
| 10 | **Recurring Transactions** | Auto-generate invoices/bills/expenses on a schedule | Fully manual today |

### TIER 2 -- Reports (QB has 65+ reports, ERP has 3)

| # | Missing Report | What It Shows |
|---|---|---|
| 11 | **Aged Receivables (dedicated)** | Aging buckets (Current, 1-30, 31-60, 61-90, 90+) with totals -- currently just redirects to invoice list |
| 12 | **Aged Payables (dedicated)** | Same aging buckets for bills -- currently redirects to bills list |
| 13 | **General Ledger** | Every transaction posted to every account, in date order |
| 14 | **Trial Balance** | Debit/Credit for every account (you have the check, but no visual report) |
| 15 | **Customer Balance Summary** | Balance per customer with aging |
| 16 | **Vendor Balance Summary** | Balance per vendor with aging |
| 17 | **Sales by Customer Summary** | Revenue breakdown by customer |
| 18 | **Sales by Product/Service** | Revenue breakdown by item/service |
| 19 | **Purchases by Vendor Summary** | Spend breakdown by vendor |
| 20 | **Expenses by Vendor** | Expense breakdown by vendor |
| 21 | **Transaction List by Date** | All transactions (all types) in one chronological view |
| 22 | **Account QuickReport (standalone page)** | Drawer exists but no dedicated report page |
| 23 | **Customer/Vendor Statements** | Printable PDF statement showing all transactions + balance for one customer/vendor |
| 24 | **1099 Contractor Summary** | Annual report for 1099-eligible vendors |
| 25 | **Tax Summary / Sales Tax Report** | Collected vs owed sales tax |

### TIER 3 -- Banking & Reconciliation

| # | Missing Feature | What It Does |
|---|---|---|
| 26 | **Bank Reconciliation** | Match cleared transactions against bank statement line-by-line to reconcile |
| 27 | **Bank Rules** | Auto-categorize imported transactions based on rules |
| 28 | **Bank Feed Import** | Import OFX/QFX/CSV bank statements for matching |

### TIER 4 -- Settings & Configuration

| # | Missing Feature | What It Does |
|---|---|---|
| 29 | **Classes** | QB Classes for departmental tracking across transactions |
| 30 | **Locations/Departments** | Multi-location or department-level P&L tracking |
| 31 | **Tax Rates / Tax Codes management** | Create and manage tax rates applied to transactions |
| 32 | **Payment Terms management** | Create custom terms (Net 15, Net 30, 2/10 Net 30, etc.) |
| 33 | **Custom Fields on transactions** | QB custom fields on invoices, estimates, etc. |
| 34 | **Attachments** | Upload receipts/docs to transactions (QB Attachable API) |
| 35 | **Currency management** | Multi-currency support with exchange rates |

### TIER 5 -- Workflow & Automation

| # | Missing Feature | What It Does |
|---|---|---|
| 36 | **Invoice reminders (automated)** | QB auto-sends payment reminders at configured intervals |
| 37 | **Late fees** | Auto-apply late fee charges on overdue invoices |
| 38 | **Batch actions** | Bulk void, bulk send, bulk delete transactions |
| 39 | **Duplicate detection** | Flag potential duplicate invoices/bills |
| 40 | **Audit Log (QB-side)** | View who changed what in QB (not the AI audit, but a transaction-level changelog) |

---

## Recommended Priority for Implementation

**Phase 1 -- High-Impact, Moderate Effort (do first)**
- Sales Receipts + Refund Receipts (new transaction types)
- Journal Entries (general purpose, not just payroll)
- Deposits + Bank Transfers
- Aged Receivables + Aged Payables (dedicated report pages with aging buckets)
- General Ledger report
- Trial Balance report (visual)
- Transaction List by Date (all-in-one view)

**Phase 2 -- Business Critical**
- Recurring Transactions
- Batch actions (bulk send/void)
- Customer/Vendor Statements (printable)
- Expense recording (separate from Bill)
- Attachments on transactions

**Phase 3 -- Advanced**
- Bank Reconciliation workflow
- Sales Tax report
- 1099 Summary
- Classes/Locations
- Bank Feed Import + Rules
- Multi-currency

---

## Technical Notes

- The `quickbooks-oauth` edge function already has a working `qbFetch()` helper, so adding new entity handlers (SalesReceipt, Deposit, Transfer, JournalEntry, RefundReceipt) follows the exact same pattern as existing handlers.
- Aged Receivable/Payable reports can be pulled from the QB API directly (`query?query=SELECT * FROM Invoice WHERE Balance > '0'` grouped by DueDate aging) or computed client-side from existing invoice/bill data.
- The nav menu already has a "Reporting" dropdown -- new reports slot in there naturally.
- General Journal Entry creation reuses the same pattern as `handleCreatePayrollCorrection` but without the employee constraint.
- Recurring transactions require the QB `RecurringTransaction` API endpoint which is read-only in QBO API v3 -- the ERP would need its own scheduler to replicate this.
