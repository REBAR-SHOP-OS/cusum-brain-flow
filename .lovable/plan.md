

# Fix: Customer Name Empty + Payment History Not Detailed

## Root Causes

### 1. Bill To dropdown shows empty
The Radix Select component has `value="1505"` set, but when the customers list hasn't finished loading or the matching item isn't found in the dropdown, the Select renders blank. The `placeholder` prop only works when value is `undefined` -- it does NOT work when a value is set but has no matching option.

**Fix**: Replace the Select approach in edit mode with a display that always shows `customerRef.name` as the trigger text, regardless of whether the options have loaded.

### 2. Payment History shows only a generic "Paid" line
The database contains zero Payment records -- only 1,822 Invoices. The sync engine includes "Payment" in its entity types but a full backfill hasn't been run since that was added. Without payment records, only the fallback "Paid: $3,466.84" line appears (derived from `TotalAmt - Balance`).

**Fix (two-part)**:
- Frontend: Improve the fallback display so it still looks like a proper payment section even without detailed records
- Backend: Trigger a payment sync so future views show the full breakdown

## Changes

### File: `src/components/accounting/InvoiceEditor.tsx`

1. **Customer dropdown fix**: Change the `SelectTrigger` to always render `customerRef.name` as visible text. Use a `defaultValue` pattern or render the name as a child of `SelectValue` so it never appears blank.

2. **Payment history fallback improvement**: When `linkedPayments` is empty but `paid > 0`:
   - Show a single row table with the paid amount (instead of just a plain text line)
   - Keep the PAID/PARTIAL/OPEN badge
   - Add a note: "Detailed payment records pending sync"

### No other files modified
The `AccountingInvoices.tsx` already passes `payments` correctly. The sync engine already supports Payment type -- a manual backfill will populate the data.

