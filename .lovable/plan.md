

# Accounting Module Overhaul -- Audit + Redesign Plan

## STEP 1: Audit -- What Exists vs What's Missing

### Existing Components (45+ files)

| Area | Component | Status |
|---|---|---|
| Dashboard | AccountingDashboard, FinancialSnapshot, AlertsBanner | Done |
| Invoices | AccountingInvoices, InvoiceEditor | Done (list, send, void, sort, CSV) |
| Bills | AccountingBills, BillPaymentDialog | Done (list, pay) |
| Payments | AccountingPayments | Done (list, filter, CSV) |
| Customers | AccountingCustomers | Done |
| Vendors | AccountingVendors, VendorDetail, AddVendorDialog | Done |
| Estimates | AccountingDocuments (embedded), QuoteTemplateManager | Partial -- no standalone list/edit/convert |
| Credit Memos | Backend handler exists | No dedicated UI |
| Statements | AccountingStatements | Done |
| Reconciliation | AccountingReconciliation | Done |
| Chart of Accounts | AccountingAccounts | Done |
| Journal Entries | AccountingJournalEntries | Done |
| Reports | P&L, Balance Sheet, Cash Flow, Aged AR/AP, GL, Trial Balance, Tax Filing | Done |
| Deposits, Transfers, Sales/Refund Receipts | All exist | Done |
| Expense Claims | ExpenseClaimsManager | Done |
| Batch Actions, Recurring, Attachments | All exist | Done |

### Backend (quickbooks-oauth edge function)

All write handlers exist: `create-estimate`, `create-invoice`, `create-payment`, `create-bill`, `create-credit-memo`, `create-purchase-order`, plus send/void/update/convert. Idempotency guards and audit logging are in place.

### Gaps Identified

1. **Navigation**: Current top-bar dropdown menus are cluttered (70+ items across 6 dropdowns). No sidebar. Hard to find things quickly.
2. **Estimates/Quotations**: No standalone list view with create/edit/send/convert-to-invoice. Currently buried inside "Documents" tab.
3. **Credit Memos**: Backend exists, no UI to create/view/apply to invoices.
4. **Partial Payments**: Payment recording exists but lacks an allocation UI to apply payments across multiple invoices.
5. **Vendor Bill Pay**: BillPaymentDialog exists but is not prominently surfaced.
6. **Sync Status**: No per-record sync status indicator or last-error display.

---

## STEP 2: Redesign -- Accounting Sidebar

Replace the cramped top-bar dropdown menus with a collapsible left sidebar using the existing `sidebar.tsx` component.

```text
┌────────────────────┬──────────────────────────────┐
│ 💰 Accounting      │  [Page Content]              │
│ ─────────────────  │                              │
│ ▸ Dashboard        │                              │
│                    │                              │
│ SALES              │                              │
│   Estimates        │                              │
│   Invoices         │                              │
│   Payments Received│                              │
│   Credit Memos     │                              │
│   Sales Receipts   │                              │
│   Customers        │                              │
│                    │                              │
│ PURCHASES          │                              │
│   Bills            │                              │
│   Vendor Payments  │                              │
│   Vendors          │                              │
│   Expenses         │                              │
│   Purchase Orders  │                              │
│                    │                              │
│ BANKING            │                              │
│   Chart of Accounts│                              │
│   Reconciliation   │                              │
│   Deposits         │                              │
│   Transfers        │                              │
│   Journal Entries  │                              │
│                    │                              │
│ REPORTS            │                              │
│   Balance Sheet    │                              │
│   Profit & Loss    │                              │
│   Cash Flow        │                              │
│   Aged Receivables │                              │
│   Aged Payables    │                              │
│   Trial Balance    │                              │
│   General Ledger   │                              │
│   Tax Summary      │                              │
│   Statements       │                              │
│   Budget vs Actuals│                              │
│                    │                              │
│ TOOLS              │                              │
│   AI Actions       │                              │
│   AI Audit         │                              │
│   Batch Actions    │                              │
│   Recurring Txns   │                              │
│   Attachments      │                              │
│   Scheduled Reports│                              │
│   Tax Planning     │                              │
│                    │                              │
│ HR & PROJECTS      │                              │
│   (collapsible)    │                              │
│   Payroll / Recruit│                              │
│   Projects         │                              │
└────────────────────┴──────────────────────────────┘
```

### Implementation details

- **New file**: `src/components/accounting/AccountingSidebar.tsx` using the existing `Sidebar`, `SidebarGroup`, `SidebarMenu*` components from `src/components/ui/sidebar.tsx`.
- **Modify**: `AccountingWorkspace.tsx` -- wrap content in `SidebarProvider`, replace `AccountingNavMenus` with the new sidebar, keep Penny FAB and agent panel.
- **Delete**: Nothing. `AccountingNavMenus.tsx` stays but is no longer rendered (preserved for rollback).
- Active tab highlighting using the existing `activeTab` state.
- Sidebar collapses to icon-only mode on smaller screens (w-14 mini).
- Mobile: sidebar as overlay sheet, same as Shadcn sidebar default.

---

## STEP 3: Missing Core Workflows

### 3A. Estimates/Quotations (standalone tab)

**New file**: `src/components/accounting/AccountingEstimates.tsx`

- Dense table: Doc#, Customer, Date, Expiry, Amount, Status (Pending/Accepted/Closed/Rejected)
- Status chips with color coding
- Actions: View, Send, Convert to Invoice, Void
- "New Estimate" button opens `CreateTransactionDialog` with type `Estimate`
- Convert to Invoice calls existing `convert-estimate` backend action
- Search + sort + CSV export
- **No DB changes needed** -- estimates already live in `accounting_mirror`

### 3B. Credit Memos (standalone tab)

**New file**: `src/components/accounting/AccountingCreditMemos.tsx`

- Dense table: Doc#, Customer, Date, Amount, Remaining Credit, Status
- "New Credit Memo" button opens `CreateTransactionDialog` with type `CreditMemo`
- Apply to Invoice action (calls backend)
- Search + sort + CSV export
- **No DB changes needed** -- credit memos already in `accounting_mirror`

### 3C. Enhanced Payment Allocation

**Modify**: `AccountingPayments.tsx`

- When recording a new payment, show a checklist of outstanding invoices for the selected customer
- Allow partial payment amounts per invoice
- Pass linked invoice refs to the existing `create-payment` backend handler (which already supports multiple linked invoices)

### 3D. Sync Status Indicators

**New file**: `src/components/accounting/SyncStatusBadge.tsx`

- Small badge component: shows "Synced", "Pending", or "Error" with timestamp
- Used in Invoices, Estimates, Bills, Credit Memos table rows
- Reads from `qb_transactions` table (already has `status`, `error_message`, `updated_at`)

---

## STEP 4: Reporting (already mostly complete)

All requested reports already exist. The only addition:

### 4A. "Open Invoices" / "Paid Invoices" quick filters

**Modify**: `AccountingInvoices.tsx`

- Add filter chips above the table: "All", "Open", "Overdue", "Paid"
- Already has sort capability; this adds pre-built filter states

### 4B. Customer Statement PDF Export

**Modify**: `AccountingStatements.tsx`

- Add a "Print / Export PDF" button using `html2canvas` (already installed) or browser print
- Statement data is already generated; just needs a print-friendly wrapper

---

## STEP 5: QB Integration Compatibility

Already in place. No changes needed:
- Idempotency via `dedupe_key` in `qb_transactions`
- Audit logging in `activity_events`
- Per-company config in `qb_company_config`
- Sync status tracking in `qb_api_failures`

The new Estimates and Credit Memos UIs will call the existing backend handlers (`create-estimate`, `create-credit-memo`, `convert-estimate`, etc.) through the same `qbAction` pattern.

---

## Files Changed Summary

| File | Action | Description |
|---|---|---|
| `src/components/accounting/AccountingSidebar.tsx` | **Create** | Left sidebar with grouped navigation |
| `src/pages/AccountingWorkspace.tsx` | **Modify** | Wrap in SidebarProvider, replace top-nav with sidebar |
| `src/components/accounting/AccountingEstimates.tsx` | **Create** | Standalone estimates list with CRUD actions |
| `src/components/accounting/AccountingCreditMemos.tsx` | **Create** | Standalone credit memos list with apply-to-invoice |
| `src/components/accounting/SyncStatusBadge.tsx` | **Create** | Reusable sync status indicator |
| `src/components/accounting/AccountingPayments.tsx` | **Modify** | Add invoice allocation checklist |
| `src/components/accounting/AccountingInvoices.tsx` | **Modify** | Add status filter chips (All/Open/Overdue/Paid) |
| `src/components/accounting/AccountingStatements.tsx` | **Modify** | Add print/PDF export button |

### No database changes required

All needed tables (`accounting_mirror`, `qb_transactions`, `qb_company_config`) already exist with the right columns.

### No breaking changes

- All existing tabs, handlers, and data flows remain intact
- The sidebar maps to the same `activeTab` state
- `AccountingNavMenus` is preserved but no longer rendered (safe rollback)

