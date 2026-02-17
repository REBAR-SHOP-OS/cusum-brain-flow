

# Add Sortable Columns to Accounting Invoices Table

## What Changes

The Invoices table on the Accounting page will get clickable, sortable column headers for: **Invoice #**, **Customer**, **Date**, **Due**, **Total**, **Balance**, and **Status**. Clicking a header toggles between ascending and descending order. A small arrow icon indicates the active sort direction.

## Single File Change

### `src/components/accounting/AccountingInvoices.tsx`

- Add `sortField` and `sortDir` state (default: sort by DocNumber descending)
- Add a `toggleSort` handler that flips direction or sets a new field
- Replace plain `TableHead` text with clickable sort buttons (reusing the `ArrowUpDown` icon pattern from `CustomerTable.tsx`)
- Sort the `filtered` array using a stable comparator before rendering
- Supported sort fields: `DocNumber`, `CustomerRef.name`, `TxnDate`, `DueDate`, `TotalAmt`, `Balance`, `status` (derived)

## Technical Details

- Sort logic uses `localeCompare` for strings, numeric comparison for amounts, and `Date` comparison for dates
- Status sorting maps Paid=0, Open=1, Overdue=2 for consistent ordering
- No new dependencies, no new files, no changes to any other component
- The existing search filter runs first, then sort applies on top

