
# Make Invoices Editable (Like QuickBooks)

## Problem

Currently, clicking an invoice opens a **read-only print template** (InvoiceTemplate). In QuickBooks, clicking an invoice opens an **editable form** where you can modify customer, dates, terms, line items, etc. Our app has no edit capability.

## Solution

Build an editable invoice detail view that mirrors QuickBooks' invoice editor, and add an `update-invoice` action to the backend.

## Changes

### 1. Backend: Add `update-invoice` action to `quickbooks-oauth` edge function

Add a new `handleUpdateInvoice` function that:
- Fetches the current invoice from QB to get the latest SyncToken
- Applies a sparse update with the changed fields (customer, due date, line items, memo, etc.)
- Posts back to QB via `POST /invoice` with `sparse: true`
- Returns the updated invoice

Wire it up in the main switch: `case "update-invoice": return handleUpdateInvoice(...)`

### 2. Frontend: Add `updateInvoice` to `useQuickBooksData.ts` hook

Add a new function:
```
updateInvoice(invoiceId, syncToken, updates) -> calls qbAction("update-invoice", ...)
```

Expose it in the returned object alongside `sendInvoice` and `voidInvoice`.

### 3. New Component: `InvoiceEditor.tsx`

Create `src/components/accounting/InvoiceEditor.tsx` -- a full-screen overlay (like InvoiceTemplate) but with editable fields:

- **Header**: Invoice number (read-only), Edit/Save/Cancel buttons
- **Customer**: Dropdown select from QB customers list
- **Dates**: Invoice date, Due date (date pickers)
- **Line Items Table**: Editable rows with description, qty, unit price, tax, amount; add/remove rows
- **Totals**: Auto-calculated untaxed, tax, total, paid, amount due
- **Memo**: Editable text field

Starts in **view mode** (read-only, styled like current template). Clicking "Edit" switches fields to editable inputs. "Save" calls `updateInvoice`, then refreshes and returns to view mode.

### 4. Update `AccountingInvoices.tsx`

Replace the `InvoiceTemplate` render with `InvoiceEditor`:
- Pass the raw QB invoice data + customers list + `updateInvoice` function
- The editor handles both viewing and editing

## Technical Details

| File | Change |
|---|---|
| `supabase/functions/quickbooks-oauth/index.ts` | Add `handleUpdateInvoice` + wire in switch statement |
| `src/hooks/useQuickBooksData.ts` | Add `updateInvoice` wrapper function |
| `src/components/accounting/InvoiceEditor.tsx` | New editable invoice detail component |
| `src/components/accounting/AccountingInvoices.tsx` | Replace InvoiceTemplate with InvoiceEditor |

## Important Constraints

- QuickBooks is the authority -- all edits go through the QB API (no local-only saves)
- Sparse updates require the current SyncToken to prevent conflicts
- After save, the invoice list is refreshed from the mirror to stay in sync
- No other parts of the app are modified
