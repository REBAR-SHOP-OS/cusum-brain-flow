

## Replicate QuickBooks "Banking Activity" Table Layout

### What Changes

Replace the current compact card-style `BankAccountsCard` with a full-width table that matches the QuickBooks "Banking Activity" section exactly.

### Target Layout (from QB screenshot)

- Collapsible header: chevron + "BANKING ACTIVITY" title
- Subtitle: "Estimate the effort to bring these accounts up to date."
- Table with 6 columns:
  - **ACCOUNTS (N)** -- account name + subtitle for accounts without bank data
  - **BANK BALANCE** -- from bank_feed_balances, or "--" if none
  - **IN QUICKBOOKS** -- the QB CurrentBalance
  - **UNACCEPTED** -- transaction count or "--"
  - **UNRECONCILED** -- transaction count
  - **RECONCILED THROUGH** -- date or "Never reconciled"
- Accounts without bank feed data show italic "No bank data. QuickBooks transactions only." under the name and "--" for Bank Balance, Unaccepted columns

### Data Sources

- **Bank Balance**: `bank_feed_balances` table (existing `getBalance`)
- **In QuickBooks**: `QBAccount.CurrentBalance`
- **Unaccepted / Unreconciled / Reconciled Through**: These columns need data from `reconciliation_matches` table, grouped by `bank_account_id`. We will query counts of matches by status. For accounts with no reconciliation data, show "--" or "Never reconciled".

### Technical Steps

**1. Add columns to `bank_feed_balances` table** (database migration)

Add three new nullable columns to store these QB-sourced stats:
- `unaccepted_count` (integer, default null)
- `unreconciled_count` (integer, default null)  
- `reconciled_through` (date, default null)

**2. Update `useBankFeedBalances` hook**

- Add the new fields to the `BankFeedBalance` interface
- No query changes needed (already selects `*`)

**3. Rewrite `BankAccountsCard` component**

Replace the card layout with a full-width table:
- Collapsible section using Radix Collapsible (already installed)
- Header row with column titles matching QB exactly
- Each account as a table row with proper alignment
- "--" placeholders for missing data
- "No bank data. QuickBooks transactions only." italic subtitle for accounts without feed
- "Never reconciled" for accounts without reconciliation date
- Transaction counts derived from reconciliation_matches query

**4. Derive unreconciled/unaccepted counts from `reconciliation_matches`**

Add a query in the component (or a new hook) that groups `reconciliation_matches` by `bank_account_id` and `status` to compute:
- Unaccepted = count where status = 'pending'
- Unreconciled = total count of all matches for that account

**5. Update `AccountingDashboard` grid**

Make the BankAccountsCard span the full width of the grid (`col-span-full`) since it's now a wide table, not a narrow card.

### Files Changed

- `src/components/accounting/BankAccountsCard.tsx` -- full rewrite to table layout
- `src/components/accounting/AccountingDashboard.tsx` -- adjust grid span
- `src/hooks/useBankFeedBalances.ts` -- add new fields to interface
- Database migration: add columns to `bank_feed_balances`
