

# Add "Create" Buttons Across Accounting Sections

The user wants "Add" action buttons (like the existing "Add Customer" button) placed in the Invoices, Quotations/Estimates, and Bills sections so users can create new records directly from those views.

## Current State

- **Customers** tab already has an "+ Add Customer" button — this is the pattern to follow.
- **Invoices** tab (`AccountingInvoices.tsx`) has search + filter + export but no "Add Invoice" button.
- **Estimates** tab (`AccountingEstimates.tsx`) has search + export but no "Add Quotation" button.
- **Bills** tab (`AccountingBills.tsx`) has search but no "Add Bill" button.
- A `CreateTransactionDialog` already exists supporting Invoice, Estimate, Payment, SalesReceipt, and CreditMemo types — but it requires a `customerQbId`, so it's tied to the Customer Detail view.

## Plan

### 1. AccountingInvoices.tsx — Add "+ Create Invoice" button

Add a `+ Create Invoice` button next to the search/filter bar (line ~158, beside the Export CSV button). Clicking it will open the `CreateTransactionDialog` with type "Invoice". Since the dialog requires a customer, we'll need a customer-selection step — either:
- Open the dialog with a customer picker dropdown pre-integrated, OR
- Add a small intermediate modal to pick a customer first

Given the existing `CreateTransactionDialog` already has a `customerQbId` prop, we'll add a lightweight **customer-select dialog** that appears first, then opens the transaction dialog with the chosen customer.

### 2. AccountingEstimates.tsx — Add "+ Create Quotation" button

Same pattern — add a `+ Create Quotation` button next to the Export CSV button. Opens customer-select, then `CreateTransactionDialog` with type "Estimate".

### 3. AccountingBills.tsx — Add "+ Add Bill" button

Bills don't use `CreateTransactionDialog` (it's for customer-facing docs). For bills, add a placeholder `+ Add Bill` button that shows a toast "Coming soon" or links to QuickBooks, since bill creation via QB API would need a separate implementation.

### 4. Shared CustomerSelectDialog component

Create a new `src/components/accounting/CustomerSelectDialog.tsx`:
- A simple dialog with a search input
- Lists QB customers from `data.customers`
- On select, returns the customer's QB ID and name
- Used by Invoices and Estimates sections

## Files to Change

| File | Change |
|---|---|
| `src/components/accounting/CustomerSelectDialog.tsx` | **New file** — reusable customer picker dialog |
| `src/components/accounting/AccountingInvoices.tsx` | Add `+ Create Invoice` button, import CustomerSelectDialog and CreateTransactionDialog, add state for dialogs |
| `src/components/accounting/AccountingEstimates.tsx` | Add `+ Create Quotation` button, same dialog pattern |
| `src/components/accounting/AccountingBills.tsx` | Add `+ Add Bill` button (placeholder with toast) |

## Technical Details

**CustomerSelectDialog** will accept:
- `open` / `onOpenChange` — standard dialog props
- `customers` — array of QB customers (from `data.customers`)
- `onSelect(qbId: string, name: string)` — callback when a customer is picked

**Flow**: User clicks "Create Invoice" → CustomerSelectDialog opens → user picks customer → CreateTransactionDialog opens with that customer's QB ID and name → transaction created via QB API → dialog closes and data refreshes.

The CreateTransactionDialog already handles the full QB API call via the `quickbooks-oauth` edge function, so no backend changes are needed.

