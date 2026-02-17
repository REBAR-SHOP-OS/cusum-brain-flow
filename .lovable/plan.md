

# Redesign Customers Page to Match QuickBooks Layout

## What Changes

Transform the Customers page from the current sidebar list + detail panel layout into a QuickBooks-style full-width table view with summary cards, open balance data, and action dropdowns.

## Visual Layout

### 1. Summary Bar (top)
Five stat cards showing:
- **Estimates** (count + total from `quotes` table)
- **Unbilled Income** (placeholder $0.00)
- **Overdue Invoices** (count + total from `qb_transactions` where Balance > 0 and DueDate < today)
- **Open Invoices and Credits** (count + total)
- **Recently Paid** (count + total from invoices where Balance = 0)

Below the cards, a colored progress bar visualizing the proportions.

### 2. Search + Toolbar
- Search input (left)
- Print, Export, Settings icon buttons (right)

### 3. Full-Width Table
Columns: NAME, COMPANY NAME, PHONE, OPEN BALANCE, ACTION

- **NAME**: Customer name (sortable)
- **COMPANY NAME**: From `customers.company_name`
- **PHONE**: From primary contact in `contacts` table (joined)
- **OPEN BALANCE**: Computed from `qb_transactions` (invoices with Balance > 0), matched via `customers.quickbooks_id`
- **ACTION**: "Create invoice" button + dropdown with: Create sales receipt, Create estimate, Create charge, Create statement, Make inactive

Clicking a row navigates to / opens the existing `CustomerDetail` view.

## Technical Details

### Files Modified

**`src/pages/Customers.tsx`** -- Major rewrite:
- Replace sidebar+detail split layout with full-width table
- Add summary stat queries:
  - Query `qb_transactions` for invoice balance aggregates grouped by customer QB ID
  - Query `quotes` for estimate totals
- Join contacts for phone numbers (use a single query with primary contact join)
- Add sort state for table columns (name, company, open balance)
- Keep the existing `CustomerFormModal` and `CustomerDetail` (detail opens as a slide-over or modal on row click)

**`src/components/customers/CustomerList.tsx`** -- Replace with new `CustomerTable.tsx`:
- Full-width table component using the existing `Table` UI primitives
- Sortable column headers
- Per-row action dropdown using `DropdownMenu`
- Open balance column with currency formatting
- Checkbox column for bulk selection (future use)

**`src/components/customers/CustomerSummaryBar.tsx`** -- New file:
- Five stat cards in a row
- Colored progress/proportion bar beneath
- Receives aggregated data as props

**`src/components/customers/CustomerDetail.tsx`** -- Minor change:
- Wrap in a Sheet/Dialog instead of inline panel so it works with table layout
- No functional changes to the detail content

### Data Strategy

Open balance per customer:
- Query `qb_transactions` where `entity_type = 'Invoice'` and extract `Balance` and `CustomerRef.value` from `raw_json`
- Group by QB customer ID, sum balances
- Match to `customers` table via `customers.quickbooks_id`
- This is done client-side by fetching both datasets and joining in a `useMemo`

Phone numbers:
- Already available in `contacts` table (2,528 records with phone)
- Query contacts with `is_primary = true` and join to customers

### No Database Changes Required
All data already exists -- just needs different presentation.

