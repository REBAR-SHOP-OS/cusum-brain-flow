
# Fix: Show Actual Bank Balance from Bank Feed (Not Just Posted Balance)

## Problem
The Chart of Accounts page has a "Bank Balance" column that always shows "---" for bank accounts. The user can see the posted/book balance (CurrentBalance from QuickBooks) but NOT the actual bank feed balance. In QuickBooks, bank accounts show both values (e.g., "Bank: $24,955.74" and "Posted: $32,035").

## Root Cause
The edge function `handleListAccounts` queries `SELECT * FROM Account` which returns `CurrentBalance` (the book balance) but does NOT include bank feed balances. The bank feed balance requires reading the QuickBooks `CompanyInfo` resource or individual account reads -- the standard bulk Account query does not include it.

QuickBooks Online does NOT expose the bank feed balance through the standard Account query API. The `BankBalance` field that the frontend tries to read from the response simply does not exist in the API response.

## Solution

### Part 1: Edge Function -- New "get-bank-balances" Action
**File: `supabase/functions/quickbooks-oauth/index.ts`**

Add a new handler `handleGetBankBalances` that:
1. First queries all Bank-type accounts to get their IDs: `SELECT Id, Name FROM Account WHERE AccountType = 'Bank'`
2. Then reads each bank account individually via `GET /v3/company/{realmId}/account/{id}` -- individual reads sometimes return additional metadata
3. If individual reads don't include bank feed balance (which is likely), fall back to a practical approach: store the bank balance in a new `bank_feed_balances` table that can be manually updated or synced from a bank feed integration

### Part 2: Practical Approach -- Manual Bank Balance Entry
Since the QuickBooks API does not expose live bank feed balances through its public API, the most reliable solution is:

**New database table: `bank_feed_balances`**
```sql
CREATE TABLE public.bank_feed_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,           -- QB Account ID
  account_name TEXT NOT NULL,
  bank_balance NUMERIC NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  company_id UUID NOT NULL
);
```

**UI Changes in `AccountingAccounts.tsx`:**
- Fetch `bank_feed_balances` on mount
- Match by `account_id` to populate the "Bank Balance" column
- Add a small edit (pencil) icon next to each Bank-type account's balance that opens an inline editor to manually set the bank feed balance
- Show the last-updated timestamp as a tooltip so the user knows how fresh the data is

**Visual change on bank account rows:**
```
Before:  QuickBooks Balance: $32,035.00  |  Bank Balance: ---
After:   QB Balance: $32,035.00  |  Bank Balance: $24,955.74 (pencil icon) 
                                     Updated: 2 hours ago
```

### Part 3: Dashboard Bank Summary Card
Add or update the bank summary on the Accounting Dashboard to show both values side by side for each bank account, with a clear label distinguishing "Book Balance" vs "Bank Balance" and a visual indicator if they differ (yellow warning icon when there's a discrepancy).

## What Changes

| File | Change |
|------|--------|
| Database migration | Create `bank_feed_balances` table with RLS policies |
| `src/components/accounting/AccountingAccounts.tsx` | Fetch bank balances from new table, show in column, add inline edit |
| `src/components/accounting/AccountingDashboard.tsx` | Show bank vs book discrepancy in bank summary card |

## What Does NOT Change
- The `useQuickBooksData` hook -- untouched
- The QuickBooks edge function Account queries -- untouched
- All other accounting modules -- untouched
- Invoice, bill, payment flows -- untouched

## Guards
- RLS policy on `bank_feed_balances`: company-scoped access only
- Inline edit has debounced save (no rapid-fire DB writes)
- Tooltip shows staleness of bank balance data
- If no manual balance is entered, column still shows "---" (no fake data)
