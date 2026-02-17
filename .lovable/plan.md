

# Make Customer Details Editable Inline

## Problem

The "Customer Details" tab in the customer detail slide-over only shows read-only text fields with an "Edit Customer Details" button that opens a separate modal dialog. The user wants fields to be directly editable within the detail view itself.

## What Changes

### `src/components/customers/CustomerDetail.tsx`

Replace the read-only `InfoRow` grid in the "Customer Details" tab (lines 426-446) with inline-editable form fields:

- **Name**, **Company Name**: Editable `Input` fields
- **Email**, **Phone**: Editable `Input` fields (saved to `contacts` table for primary contact, or displayed from QB data as read-only fallback)
- **Status**: Editable `Select` dropdown (active / inactive / prospect)
- **Type**: Editable `Select` dropdown (business / individual)
- **Payment Terms**: Editable `Select` dropdown (Net 15 / Net 30 / Net 60 / Due on Receipt)
- **Credit Limit**: Editable number `Input`
- **Billing Address**, **Shipping Address**: Read-only (sourced from QuickBooks -- cannot edit locally)
- **QuickBooks ID**, **Created**: Read-only display

Add a save mutation that updates the `customers` table on field blur or via a "Save Changes" button at the bottom of the form. Fields will use `react-hook-form` with the existing `customerSchema` from `CustomerFormModal.tsx` for validation.

### `src/components/customers/CustomerTable.tsx`

Add two missing columns to match the user's screenshot:
- **Invoices**: Count of `qb_transactions` where `entity_type = 'Invoice'` for each customer
- **Overdue**: Count of overdue invoices (balance > 0 and DueDate < today)
- **Status**: Customer status badge column

Update the `CustomerRow` interface to accept `invoiceCount` and `overdueCount`.

### `src/pages/Customers.tsx`

- Compute `invoiceCount` and `overdueCount` per customer from the existing `invoiceBalances` and `overdueInvoices` queries
- Pass these new fields to `CustomerTable`
- After saving edits in the detail view, invalidate the `customers` query so the table refreshes

## Technical Details

- Reuse the same zod schema from `CustomerFormModal` for validation consistency
- The inline form will use `useForm` with `defaultValues` populated from the selected customer
- Save triggers on a "Save Changes" button click (not on blur, to avoid accidental saves)
- QB-sourced fields (addresses, QB ID) remain read-only with a label indicating they sync from QuickBooks
- The `CustomerFormModal` remains available for the "New Customer" flow from the header button

