

# Fix: Wire Up Customer Detail View in Accounting Customers Tab

## Problem

All previous improvements (clickable rows, detail slide-over, inline editing, full QB fields, transaction list) were made to `src/pages/Customers.tsx` and `src/components/customers/CustomerDetail.tsx`. However, the user is on `/accounting` which renders `AccountingCustomers.tsx` -- a completely separate, basic read-only table with no row click, no detail panel, and no editing.

## Solution

Enhance `AccountingCustomers.tsx` to include:
1. Clickable rows that open a detail slide-over (Sheet)
2. Reuse the existing `CustomerDetail` component inside that Sheet
3. Customer lookup: map the QB customer to the local `customers` table via `quickbooks_id` so the detail view works

## Changes

### `src/components/accounting/AccountingCustomers.tsx`

- Add state for `selectedQbCustomerId`
- On row click, set the selected QB customer
- Query the local `customers` table to find matching customer by `quickbooks_id`
- Render a `Sheet` with `CustomerDetail` component (already built with full QB data, transactions, editable fields, notes)
- Import `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` from UI
- Import `CustomerDetail` and `CustomerFormModal` from customers components
- Add edit/delete handlers matching the pattern from `Customers.tsx`

### No other files need changes

The `CustomerDetail` component already handles:
- Full QB field display (all 30+ fields)
- Transaction list with filters
- Inline editable local settings (name, company, status, type, payment terms, credit limit)
- Notes editing
- Financial summary

## Technical Details

The mapping flow:
1. User clicks a row in `AccountingCustomers` table
2. The row has `c.Id` (the QuickBooks customer ID)
3. Query `customers` table where `quickbooks_id = c.Id` to get the local customer record
4. Pass that customer record to `CustomerDetail`
5. If no local customer exists (QB-only customer), show a simplified read-only view or prompt to create one

The `CustomerDetail` component internally queries `qb_customers` by `customer.quickbooks_id` for the full raw_json, so no duplication -- it will automatically load all fields.

