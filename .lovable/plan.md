

## Replicate QuickBooks "BANK ACCOUNTS" Card on Dashboard

### What Changes

Replace the two separate BankAccountCard components (Checking + Savings) with a single unified "BANK ACCOUNTS" card that matches the QuickBooks layout exactly.

### QuickBooks Layout to Replicate

- Header: "BANK ACCOUNTS" (uppercase, bold) with "As of today" on the right
- Top summary: "Today's bank balance" label with large total dollar amount and info icon
- Account list: Each account as a row with:
  - Blue circle bank icon on the left
  - Account name in bold (e.g., "PETTY CASH", "BMO BUSINESS - 3434-199151...")
  - For accounts with bank feed data: two lines showing "Bank balance $X" and "In QuickBooks $Y" with "Updated X hours ago" timestamp and a green "Reviewed" badge
  - For accounts without bank feed: single line "In QuickBooks" with balance on the right
- Footer: "Go to registers" link with dropdown arrow, gear icon, and three-dot menu

### Technical Details

**File: `src/components/accounting/AccountingDashboard.tsx`**

1. **Remove** the existing `BankAccountCard` component (lines 174-237)
2. **Create** a new `BankAccountsCard` component that:
   - Takes all bank accounts (both checking and savings) as a flat list
   - Renders the QB-style header with "BANK ACCOUNTS" and "As of today"
   - Shows "Today's bank balance" with the sum of all bank balances (preferring bank feed balance when available, falling back to QB book balance)
   - Lists each account row with:
     - A blue circle with a `Landmark` (bank) icon
     - Account name in uppercase bold
     - If bank feed balance exists: "Bank balance" + amount, "In QuickBooks" + QB amount, "Updated X ago" using `date-fns` `formatDistanceToNow`, green checkmark "Reviewed" badge
     - If no bank feed: "In QuickBooks" label + QB balance only
   - Footer with "Go to registers" button linking to the accounts tab

3. **Update** the dashboard grid (lines 337-370):
   - Replace the two `BankAccountCard` calls with a single `<BankAccountsCard>` spanning full width on the grid row
   - Pass all `bankAccounts` (no checking/savings split needed)
   - Remove the now-unused variables (`checkingAccounts`, `savingsAccounts`, totals, bank feed sums)

4. **Update** `useBankFeedBalances` usage: use `balances` array directly alongside `getBalance` to access `last_updated` timestamps for "Updated X ago" display

### Layout

The card will use the same grid slot as the current two bank cards. It will be styled as a single Card spanning one column but containing the full vertical list internally -- matching the QB widget proportions.

