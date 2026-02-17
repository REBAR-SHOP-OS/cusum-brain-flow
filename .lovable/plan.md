

# Audit and Enhance Customer Detail View (QuickBooks Clone)

## Current State

The `CustomerDetail` component is a simple slide-over with basic tabs (Contacts, Orders, Quotes, Comms) and limited customer info. The QuickBooks reference screenshots show a much richer detail page with:

1. **Header**: Customer avatar/initials, email, phone, billing address, shipping address, notes, custom fields, and a **Financial Summary** card (open balance + overdue payment totals)
2. **Action buttons**: "Edit" button, "New transaction" dropdown (Invoice, Payment, Estimate, Sales receipt, Credit memo, etc.)
3. **Tabs**: Transaction List, Activity Feed, Statements, Recurring Transactions, Customer Details, Notes, Tasks, Opportunities
4. **Transaction List tab**: A full table with Date, Type, No., Customer, Memo, Amount, Status, and Action columns -- showing all `qb_transactions` for that customer

## What Will Change

### 1. Redesign `CustomerDetail.tsx` -- Full QuickBooks-style detail view

**Header section:**
- Customer avatar circle with initials (first 2 chars of name)
- Company name below the customer name
- Quick action icons (email, phone, copy, edit)
- Right side: Email, Phone, Billing Address, Shipping Address (pulled from `qb_customers.raw_json`)
- Notes section with "Add notes" link
- **Financial Summary card** (top-right): Open balance + Overdue payment totals computed from `qb_transactions`

**Top action bar:**
- "Edit" button (opens existing `CustomerFormModal`)
- "New transaction" dropdown: Invoice, Payment, Estimate, Sales receipt, Credit memo, Statement

**Tabs (matching QuickBooks exactly):**
- **Transaction List** (default): Full table of all `qb_transactions` for this customer with columns: Date, Type, No., Customer, Memo, Amount, Status, Action (View/Edit). Includes filters for Type, Status, Date. Data from `qb_transactions` where `customer_qb_id` matches.
- **Customer Details**: Editable fields -- name, company, email, phone, billing/shipping address, payment terms, credit limit, status, type. Uses inline editing or the existing `CustomerFormModal`.
- **Notes**: Display and edit `customer.notes`
- Other tabs (Activity Feed, Statements, Recurring Transactions, Tasks, Opportunities) as placeholder tabs

### 2. Expand `CustomerTable.tsx` action dropdown

Add missing menu items to match screenshot:
- Create charge
- Create time activity
- Create task
- Request feedback

### 3. Widen the detail Sheet

Change `SheetContent` from `sm:max-w-lg` to `sm:max-w-4xl` to accommodate the full-width transaction table.

## Technical Details

### Data sources for CustomerDetail header

**Contact info (email, phone, address)**: Query `qb_customers` table where `qb_id` matches `customer.quickbooks_id`. Extract from `raw_json`:
- `PrimaryEmailAddr.Address` -- email
- `PrimaryPhone.FreeFormNumber` -- phone  
- `BillAddr.Line1` -- billing address
- `ShipAddr.Line1` -- shipping address

Fallback to `contacts` table primary contact if no QB data.

### Transaction List tab

Query `qb_transactions` where `customer_qb_id = customer.quickbooks_id`:
- Display columns: Date (`txn_date`), Type (`entity_type`), No. (`doc_number`), Customer (customer name), Memo (from `raw_json.PrivateNote`), Amount (`total_amt`), Status (derived: if balance=0 "Closed", if overdue "Overdue X days", else "Open"), Action ("View/Edit")
- Filters: Type dropdown (All, Invoice, Payment, Estimate, etc.), Status dropdown (All, Open, Closed, Overdue), Date dropdown (All, Last 30 days, etc.)
- Sort by date descending by default

### Financial Summary card

Computed from `qb_transactions` for this customer:
- **Open balance**: Sum of `balance` where `entity_type = 'Invoice'` and `balance > 0`
- **Overdue payment**: Sum of `balance` where invoice DueDate < today (from `raw_json.DueDate`)

### Files modified

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Major rewrite: QB-style header with contact info from `qb_customers`, Financial Summary card, full tabbed interface with Transaction List table, Customer Details tab, Notes tab |
| `src/components/customers/CustomerTable.tsx` | Add missing action dropdown items (Create charge, Create time activity, Create task, Request feedback) |
| `src/pages/Customers.tsx` | Widen the Sheet to `sm:max-w-4xl`, pass `openBalance` to CustomerDetail |

### No database changes required

All data already exists in `qb_customers.raw_json` (addresses, email, phone) and `qb_transactions` (all transaction types). The `customers.quickbooks_id` field links to `qb_customers.qb_id` and `qb_transactions.customer_qb_id`.

