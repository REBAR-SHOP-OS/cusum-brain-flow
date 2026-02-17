
# Audit, Diagnose, Fix and Improve: Chart of Accounts + Vendor Forms

## Problems Found

### 1. No "New Account" Form in Chart of Accounts
The COA table has no way to create a new account. QuickBooks (your screenshots) shows a slide-over "New account" form with:
- Account name field
- Account type dropdown grouped by category (ASSET: Bank, Accounts receivable, Current assets, Property/plant/equipment, Long-term Assets | LIABILITY: Credit Card, Accounts payable, Other Current Liabilities, Long-term Liabilities | EQUITY: Equity | INCOME: Income, Other Income | EXPENSE: Cost of Goods Sold, Expenses, Other Expense)
- Detail type dropdown (changes dynamically based on selected account type)
- Currently: nothing exists -- no form, no edge function action

### 2. COA Table Missing "TAX" Column
QuickBooks shows a TAX column between Detail Type and QuickBooks Balance. Current table skips this entirely.

### 3. Vendor "Add" Form is Too Minimal
Current `AddVendorDialog` only has 5 fields: Display Name, Company Name, Email, Phone, Notes. QuickBooks (your screenshots) shows a full-featured Supplier form with:
- Company name (searchable)
- Supplier display name (dropdown)
- Title, First name, Middle name, Last name, Suffix
- Email, Phone number, Mobile number, Fax, Other, Website
- Name to print on cheques
- Address section (Street address 1, Street address 2, Add lines)
- Current form is missing 12+ fields

### 4. Vendor Detail Missing Delete/Void Actions
QuickBooks shows Delete and Void options in the Action column dropdown next to "View/Edit" on each transaction row. Current implementation only has "View/Edit" with no delete/void.

### 5. Edge Function Missing "create-account" Action
The `quickbooks-oauth` edge function has no handler for creating accounts in QuickBooks. Also the `create-vendor` handler only accepts 5 fields -- needs to accept all QB Vendor fields.

---

## What Will Be Built

### 1. New "Create Account" Slide-Over for Chart of Accounts
- Add a "New" button at the top of the COA page
- Create a `NewAccountDrawer` component as a Sheet slide-over (matching QB's "New account" panel)
- Fields: Account name, Account type (grouped Select with category headers matching QB exactly), Detail type (dynamic options based on selected account type)
- The grouped Account Type dropdown will have these exact categories and options from your screenshots:
  - ASSET: Bank, Accounts receivable (A/R), Current assets, Property plant and equipment, Long-term Assets
  - LIABILITY: Credit Card, Accounts payable (A/P), Other Current Liabilities, Long-term Liabilities
  - EQUITY: Equity
  - INCOME: Income, Other Income
  - EXPENSE: Cost of Goods Sold, Expenses, Other Expense
- On submit: calls a new `create-account` action in the edge function

### 2. Add TAX Column to COA Table
- Extract `TaxCodeRef` from account `raw_json`
- Display tax label (e.g., "HST ON") between Detail Type and QuickBooks Balance columns

### 3. Rebuild Vendor Form to Match QB Supplier Form
- Replace the minimal `AddVendorDialog` with a full-featured `AddVendorDialog` matching the QB Supplier form from your screenshot
- Collapsible sections: "Name and contact" and "Address"
- All fields: Company name, Supplier display name, Title, First name, Middle name, Last name, Suffix, Email, Phone number, Mobile number, Fax, Other, Website, Name to print on cheques, Street address 1, Street address 2, City, Province/State, Postal/ZIP code
- Update the edge function `create-vendor` handler to accept all these fields

### 4. Add Delete/Void Actions to Vendor Transaction List
- Change the "View/Edit" button in `VendorDetail` transaction rows to a dropdown with: View/Edit, Delete, Void
- Delete and Void will call appropriate QB API actions (update transaction with `SparseUpdate` setting Active=false or adding void flag)

### 5. Edge Function Updates
- Add `create-account` handler to `quickbooks-oauth` edge function (POST to QB `account` endpoint with Name, AccountType, AccountSubType)
- Expand `create-vendor` handler to accept all new fields (Title, FirstName, MiddleName, LastName, Suffix, Mobile, Fax, WebAddr, PrintOnCheckName, BillAddr)

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/accounting/NewAccountDrawer.tsx` | **New** -- Sheet slide-over with grouped Account Type dropdown and dynamic Detail Type |
| `src/components/accounting/AccountingAccounts.tsx` | Add "New" button, TAX column, import NewAccountDrawer |
| `src/components/accounting/AddVendorDialog.tsx` | **Major rewrite** -- Full QB Supplier form with all fields and collapsible sections |
| `src/components/accounting/VendorDetail.tsx` | Add Delete/Void dropdown on transaction rows |
| `supabase/functions/quickbooks-oauth/index.ts` | Add `create-account` handler + expand `create-vendor` with all fields |

## Technical Details

- The grouped Account Type dropdown uses Radix Select with `SelectGroup` and `SelectLabel` for category headers (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE)
- Detail Type options are a static map keyed by Account Type (e.g., Bank -> [Chequing, Savings, Cash on hand, Money market, Trust accounts, Rents held in trust])
- The `create-account` edge function handler calls `qbFetch(config, "account", { method: "POST", body: JSON.stringify({ Name, AccountType, AccountSubType }) })`
- The expanded `create-vendor` handler maps form fields to the QB Vendor API payload: `{ DisplayName, CompanyName, GivenName, MiddleName, FamilyName, Suffix, Title, PrimaryEmailAddr, PrimaryPhone, Mobile, Fax, WebAddr, PrintOnCheckName, BillAddr: { Line1, Line2, City, CountrySubDivisionCode, PostalCode } }`
- Delete action calls QB API with sparse update to set `Active: false`
- Void action dispatches to a `void-transaction` handler (or reuses existing void logic)
- No database schema changes needed
