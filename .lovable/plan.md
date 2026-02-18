
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

---
---

# Odoo vs ERP: Complete Feature Gap Analysis

## Summary

After auditing every Odoo-related edge function, UI component, hook, migration, and DB table in the ERP, here is the full apple-to-apple comparison against Odoo 17 Community/Enterprise.

---

## WHAT YOU ALREADY HAVE (Covered from Odoo)

| Odoo Module / Feature | ERP Status | Implementation |
|---|---|---|
| **CRM — Pipeline (Kanban)** | ✅ DONE | `Pipeline.tsx` + `PipelineBoard` with 28 Odoo stages mapped 1:1 |
| **CRM — Lead/Opportunity sync** | ✅ DONE | `odoo-crm-sync` edge function (incremental + full mode) |
| **CRM — Stage mapping (28 stages)** | ✅ DONE | `STAGE_MAP` in sync function, all 28 Odoo stages covered |
| **CRM — Lead priority (stars)** | ✅ DONE | `odoo_priority` mapped to 0-3 star display in `LeadCard` |
| **CRM — Salesperson assignment** | ✅ DONE | `odoo_salesperson` synced and filterable in pipeline |
| **CRM — Probability/Revenue** | ✅ DONE | `odoo_probability` + `odoo_revenue` synced, shown in cards |
| **CRM — Expected close date** | ✅ DONE | `date_deadline` → `expected_close_date` for SLA color bars |
| **CRM — Contact/Partner linkage** | ✅ DONE | Auto-creates customers on sync, enforces `customer_id` |
| **CRM — Activity timeline (Chatter)** | ✅ DONE | `LeadTimeline` + `lead_events` table, Odoo-style chatter |
| **CRM — Lead attachments/files** | ✅ DONE | `lead_files` table + `odoo-file-proxy` for download |
| **CRM — File migration to storage** | ✅ DONE | `archive-odoo-files` batch cron (18K+ files) |
| **CRM — Dump ZIP import** | ✅ DONE | `OdooDumpImportDialog` for bulk ZIP restore |
| **CRM — Deduplication** | ✅ DONE | Auto-dedup in sync with rollback logging (`dedup_rollback_log`) |
| **CRM — Reconciliation report** | ✅ DONE | `odoo-reconciliation-report` edge function + UI in Admin |
| **CRM — Migration status dashboard** | ✅ DONE | `OdooMigrationStatusCard` in CEO Portal |
| **Sales — Quotations (archived Odoo)** | ✅ DONE | `useArchivedQuotations` hook, `quotes` table with `odoo_id` |
| **Sales — Quote → Order conversion** | ✅ DONE | `convert-quote-to-order` edge function |
| **Operations — Autopilot risk policies** | ✅ DONE | `autopilot_risk_policies` with Odoo model protection |
| **Operations — Code patch review** | ✅ DONE | `code_patches` with `target_system = 'odoo'` support |
| **Architect agent — Odoo diagnostics** | ✅ DONE | Empire Builder agent has cross-platform Odoo capabilities |

---

## WHAT IS MISSING (Gaps)

### TIER 1 — CRM Features (Odoo has them, ERP does not)

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 1 | **Activities (scheduled)** | Odoo Activities: schedule calls, emails, meetings with due dates + responsible person. Color-coded (overdue/today/planned). | ERP has no scheduled activity system — only timeline events. No "Plan activity" button. |
| 2 | **Lead Scoring (predictive)** | Odoo's ML-based lead scoring with configurable weights per field | ERP has `probability` from Odoo but no local scoring engine |
| 3 | **Lead Enrichment** | Auto-enrich company data from domain (Odoo IAP) | No enrichment — only what Odoo syncs |
| 4 | **Quotation Templates** | Reusable quote templates with predefined products, terms, optional items | No template system for quotes |
| 5 | **Online Quotation (portal)** | Customer-facing portal to view, approve, sign, pay quotes online | No customer-facing portal |
| 6 | **eSignature on quotes** | Digital signature capture directly on quotation | No signature capture |
| 7 | **Customer Portal** | Full self-service portal: view invoices, track orders, download docs | No customer portal exists |

### TIER 2 — Sales Order Features

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 8 | **Sale Order Line Items (from Odoo)** | `sale.order.line` sync — individual line items with products, qty, price | Only totals synced; line items require manual entry (known limitation) |
| 9 | **Upselling / Cross-selling** | Suggest related products on quotation | No product recommendations |
| 10 | **Margin analysis** | Cost vs sale price per line, margin % | No margin tracking on orders |
| 11 | **Pricelist management** | Multiple pricelists per customer/segment with rules | No pricelist system |
| 12 | **Discount management** | Per-line and global discount rules | No discount engine |

### TIER 3 — Inventory / Warehouse (Odoo has full WMS)

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 13 | **Stock Moves / Transfers** | Track inventory movements between locations | ERP has `cut_output_batches` but no general stock moves |
| 14 | **Warehouse Locations (hierarchical)** | Multi-level location tree (WH/Stock/Shelf-A) | No warehouse location hierarchy |
| 15 | **Stock Valuation** | FIFO/AVCO/Standard cost valuation | No inventory valuation |
| 16 | **Reordering Rules** | Min/Max automatic replenishment triggers | No auto-reorder |
| 17 | **Lot/Serial Number tracking** | Full traceability per lot or serial number | ERP tracks by `bar_code` + `mark_number` but no lot/serial system |
| 18 | **Stock Adjustment / Inventory Count** | Cycle counting and stock adjustment wizard | No inventory count workflow |
| 19 | **Routes / Procurement Rules** | Pull/Push rules for multi-step flows (pick → pack → ship) | No procurement routing |

### TIER 4 — Purchase (beyond what exists)

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 20 | **Vendor Pricelist** | Supplier-specific pricing per product | No vendor pricing engine |
| 21 | **Purchase Agreements (blanket orders)** | Framework agreements for recurring purchases at agreed terms | No blanket orders |
| 22 | **Receipt / Quality inspection** | Goods receipt with quality check triggers | No receipt inspection workflow |
| 23 | **3-Way Matching** | Match PO → Receipt → Vendor Bill before payment | No 3-way matching |

### TIER 5 — Accounting (Odoo-specific, beyond QB gaps)

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 24 | **Bank Reconciliation (Odoo style)** | Match bank statement lines to journal entries with AI suggestions | Covered in QB gap — same gap |
| 25 | **Analytic Accounts** | Track costs/revenues by project, department, or cost center | No analytic accounting |
| 26 | **Budget management** | Set budgets per analytic account and track actual vs budget | No budget tracking |
| 27 | **Asset management** | Track fixed assets, depreciation schedules | No asset depreciation |
| 28 | **Lock dates** | Fiscal lock periods to prevent backdating entries | No period locking |

### TIER 6 — HR / People (Odoo has full HR suite)

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 29 | **Recruitment / Job Positions** | Post jobs, track applicants, interview pipeline | No recruitment module |
| 30 | **Appraisals** | Performance reviews, goals, 360° feedback | No performance reviews |
| 31 | **Fleet management** | Company vehicle tracking, fuel logs, maintenance schedules | No fleet module (ERP has `deliveries` but not fleet) |
| 32 | **Expense Claims** | Employee expense submission, approval, reimbursement | No expense claims (only `Bills` via QB) |
| 33 | **Skills / Certifications** | Track employee certifications, expiry, training | No skill/cert tracking |
| 34 | **Employee Contracts** | Contract management with salary history, renewals | No contract management |

### TIER 7 — Project / Planning

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 35 | **Project management (Kanban)** | Tasks, subtasks, milestones, Kanban board, Gantt chart | ERP has `projects` table but no task/milestone management |
| 36 | **Timesheets (project-linked)** | Log time per task/project for billing and cost analysis | ERP has `time_activities` (QB) but not project-linked |
| 37 | **Planning / Shift management** | Drag-and-drop shift scheduling, Gantt view | No shift planning UI |

### TIER 8 — Communication & Marketing

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 38 | **Mass Mailing (campaigns)** | Email campaigns with templates, A/B test, analytics | ✅ Partially done — `email_campaigns` + `email_campaign_sends` |
| 39 | **SMS Marketing** | SMS campaigns and automated SMS | No SMS marketing |
| 40 | **Live Chat (website)** | Real-time chat widget for website visitors | ✅ DONE — `support-chat` + `website-chat-widget` |
| 41 | **Email Marketing Automation** | Drip sequences, triggered by events | ✅ Partially done — `email_automations` table exists |
| 42 | **Social Media Management** | Post to social platforms, schedule, analytics | ✅ Partially done — `social-publish` edge function |

### TIER 9 — Website / eCommerce

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 43 | **Website Builder** | Drag-and-drop website builder | Not applicable — uses WordPress |
| 44 | **eCommerce** | Full online store with cart, checkout, payment | Not applicable — B2B business |
| 45 | **Blog** | CMS-style blog management | Not applicable — WordPress handles this |

### TIER 10 — Configuration & Settings

| # | Odoo Feature | What It Does | Impact |
|---|---|---|---|
| 46 | **Multi-company** | Run multiple companies from one instance | ERP has `company_id` on tables — partially supported |
| 47 | **Access Rights / Groups** | Fine-grained module-level access control (groups + rules) | ERP has `user_roles` with role-based access — simpler model |
| 48 | **Audit Trail (Odoo tracking)** | Field-level change tracking on any model | ERP has `activity_events` + `financial_access_log` but not per-field |
| 49 | **Custom Fields / Studio** | Add custom fields to any model without code | No dynamic field creation |
| 50 | **Data Import/Export (CSV/XLSX)** | Bulk import/export any model via CSV | Limited — only specific imports (dump ZIP, CRM import) |

---

## Recommended Priority for Implementation

**Phase 1 — High-Impact, Moderate Effort**
- Scheduled Activities system (plan call/email/meeting with due dates, color-coded overdue)
- Sale Order Line Items sync from Odoo (`sale.order.line`)
- Inventory Count / Stock Adjustment workflow
- Per-field audit trail (change log on key entities)
- Budget management (set + track actuals vs budget)

**Phase 2 — Business Critical**
- Quotation Templates
- Customer Portal (view invoices, track orders)
- Expense Claims module
- 3-Way Matching (PO → Receipt → Bill)
- Employee Contracts + Certification tracking

**Phase 3 — Advanced / Long-term**
- Predictive Lead Scoring (local ML or rules engine)
- Project management with tasks + Gantt
- Multi-step warehouse routing
- Recruitment pipeline
- eSignature on quotes

---

## Technical Notes

- **Activities system**: Can be built as a new `activities` table with `activity_type`, `due_date`, `assigned_to`, `status`, linked to leads/orders/customers. Reuses the existing chatter timeline pattern in `LeadTimeline`.
- **Sale order line sync**: Requires adding `sale.order.line` to the `odoo-crm-sync` or a new `odoo-order-sync` edge function. Already noted as a known limitation.
- **Audit trail**: Can leverage PostgreSQL triggers (similar to existing `audit_financial_access`) to capture old/new values on UPDATE for key tables.
- **Customer portal**: Would require a separate auth flow (customer login vs employee login). Can use the existing `customer_user_links` table as the bridge.
- **Most Odoo inventory features** don't directly apply since the ERP is specialized for rebar fabrication — the `cut_output_batches` and `barlist_items` tables serve as the domain-specific equivalent.
