

# Make Invoices Editable (Like QuickBooks)

## Overview
Currently clicking an invoice opens a read-only print template. This plan adds full edit capability so invoices work like they do in QuickBooks -- click to view, then edit fields inline and save back to QB.

## Changes

### 1. Backend: Add `update-invoice` action
**File: `supabase/functions/quickbooks-oauth/index.ts`**

- Add a new `handleUpdateInvoice` function that:
  - Fetches the current invoice from QB by ID to get the latest SyncToken (prevents conflicts)
  - Applies a sparse update with changed fields (CustomerRef, DueDate, Line items, CustomerMemo)
  - Posts to QB via `POST /invoice` with `sparse: true`
- Wire it into the main switch: `case "update-invoice": return handleUpdateInvoice(...)`

### 2. Frontend Hook: Add `updateInvoice` wrapper
**File: `src/hooks/useQuickBooksData.ts`**

- Add `updateInvoice(invoiceId, updates)` function that calls `qbAction("update-invoice", { invoiceId, ...updates })`
- Refreshes data after successful update via `loadAll()`
- Expose in the returned object

### 3. New Component: Editable Invoice Detail
**File: `src/components/accounting/InvoiceEditor.tsx`** (new)

Full-screen overlay component with two modes:

- **View mode** (default): Displays invoice details in a clean layout similar to InvoiceTemplate, with an "Edit" button
- **Edit mode**: Switches fields to editable inputs:
  - Customer: dropdown select from QB customers list
  - Invoice date & due date: date inputs
  - Line items: editable table (description, qty, unit price) with add/remove row capability
  - Memo: text area
  - Auto-calculated totals (subtotal, tax, total, amount due)
  - Save / Cancel buttons

Props: raw QB invoice, customers list, items list, `updateInvoice` function, `onClose`

### 4. Wire Up in Invoice List
**File: `src/components/accounting/AccountingInvoices.tsx`**

- Import `InvoiceEditor` instead of `InvoiceTemplate`
- Pass `customers`, `items`, and `updateInvoice` from the data hook
- Replace the `InvoiceTemplate` render with `InvoiceEditor`

## Technical Notes

- QuickBooks sparse updates require a valid SyncToken; the backend fetches the latest before updating to prevent conflicts
- The existing `handleUpdateEmployee` pattern (fetch current -> merge -> POST sparse) is reused for invoices
- All edits go through the QB API -- no local-only saves
- After save, `loadAll()` refreshes the mirror to keep data in sync
- The trial balance hard-stop still applies to updates (enforced via the existing `postingBlocked` check)
- No other files or features are modified
