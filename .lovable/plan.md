

# Full Accounting Audit: Add Customer/Vendor Buttons, QB-Clone Chart of Accounts, and Real Reports

## Problems Found

### 1. Missing "Add Customer" Button in Accounting Customers Tab
The Customers page (`/customers`) has an "Add Customer" button using `CustomerFormModal`, but the Accounting > Customers tab (`AccountingCustomers.tsx`) has no way to add a new customer. Same applies to Vendors tab -- no "Add Vendor" button.

### 2. Chart of Accounts is NOT a QuickBooks Clone
Current layout groups accounts by `AccountType` in collapsible cards but is missing key QuickBooks COA columns:
- **Number** (Account Number/Code)
- **Type** column showing the full QB type
- **Detail Type** (AccountSubType shown but labeled "Sub-Type")
- **QuickBooks Balance** vs **Bank Balance** distinction
- **Tax Line** mapping
- Flat single-table layout (QB shows all accounts in one table with indentation for sub-accounts, not grouped cards)

### 3. Reports Are Placeholder Summaries, Not Real QB Reports
`AccountingReport.tsx` shows 3 summary cards with hardcoded aggregations from invoice/bill/payment totals. It does NOT call the actual QuickBooks Report API (`get-profit-loss`, `get-balance-sheet`), which already exists in the edge function. The reports should render the actual QB report data with proper row/column structure.

### 4. Vendor Payments Tab Shows ALL BillPayments Correctly
This was already fixed in the last iteration and is working properly.

---

## What Will Be Built

### 1. Add "Add Customer" Button to `AccountingCustomers.tsx`
- Import and use the existing `CustomerFormModal` component
- Add a "+" or "Add Customer" button next to the search bar
- On success, refresh the customers list

### 2. Add "Add Vendor" Button to `AccountingVendors.tsx`
- Create a `VendorFormDialog` component that calls the existing `create-vendor` edge function action
- Fields: Display Name, Company Name, Email, Phone, Notes
- Add button next to the search bar
- On success, trigger a QB sync/refresh

### 3. Rebuild Chart of Accounts as Exact QB Clone
Replace the grouped-cards layout with a single flat table matching QuickBooks:

| Column | Source |
|--------|--------|
| NAME | `Name` (indented for sub-accounts via `SubAccount` + `ParentRef`) |
| TYPE | `AccountType` |
| DETAIL TYPE | `AccountSubType` |
| QUICKBOOKS BALANCE | `CurrentBalance` |
| BANK BALANCE | From `raw_json` if available |
| ACTION | "View register" link |

- Sub-accounts indented under parents (QB uses tree structure)
- "New" button at top to create a new account (calls `create-item` or a future `create-account`)
- Filter by account type dropdown
- Single table, no cards -- matching QB exactly

### 4. Wire Real QB Reports (P&L, Balance Sheet, Cash Flow)
Replace `AccountingReport.tsx` placeholder with actual API calls:

- **Profit & Loss**: Call `get-profit-loss` with date range picker, render the QB report rows (Income, COGS, Expenses, Net Income) in a hierarchical table
- **Balance Sheet**: Call `get-balance-sheet` with as-of-date, render Assets/Liabilities/Equity sections
- **Cash Flow**: Derive from P&L + Balance Sheet changes (QB Online doesn't have a native Cash Flow Statement API, so keep the current derived view but improve accuracy)

Each report will have:
- Date range/as-of-date picker
- "Run Report" button
- Collapsible section rows matching QB layout
- Total rows with bold formatting
- Export option (print/download)

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/accounting/AccountingCustomers.tsx` | Add "Add Customer" button using existing `CustomerFormModal` |
| `src/components/accounting/AccountingVendors.tsx` | Add "Add Vendor" button with new dialog |
| `src/components/accounting/AddVendorDialog.tsx` | **New** -- Dialog to create vendor in QB via `create-vendor` action |
| `src/components/accounting/AccountingAccounts.tsx` | **Major rewrite** -- Flat table with QB-matching columns (Name with indent, Type, Detail Type, Balance, Action) + type filter dropdown |
| `src/components/accounting/AccountingReport.tsx` | **Major rewrite** -- Call real QB report APIs, render hierarchical report tables with date pickers |

## Technical Details

- `AccountingCustomers` will import `CustomerFormModal` from `@/components/customers/CustomerFormModal` and add state for `isFormOpen`
- `AddVendorDialog` calls `supabase.functions.invoke("quickbooks-oauth", { body: { action: "create-vendor", displayName, companyName, email, phone, notes } })`
- Chart of Accounts rebuilds the tree from flat array using `SubAccount` boolean and `ParentRef.value` from `raw_json` to create indentation levels
- P&L report calls `qbAction("get-profit-loss", { startDate, endDate })` and parses the standard QB report response format (`Rows.Row[].ColData[]`)
- Balance Sheet calls `qbAction("get-balance-sheet", { asOfDate })` with same parser
- No database changes needed -- all data comes from existing QB mirror tables and API endpoints

