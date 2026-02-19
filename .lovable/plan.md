
# Fix Unreconciled Count — Account Filter Not Working

## Problem

The `TransactionList` report does **not** support `account` as a filter parameter. QuickBooks silently ignores it, so all 4 bank accounts return the same 34 uncleared transactions (the total across ALL accounts).

The same issue applies to the reconciled report — all accounts get the same result.

## Solution

Instead of making 4 separate (broken) per-account report calls, fetch **one** `TransactionList` report with the `account` column included, then parse and group the results by account name in code.

### Changes to `supabase/functions/qb-sync-engine/index.ts`

1. **Before the per-account loop**, fetch two reports once:
   - `reports/TransactionList?cleared=Uncleared&columns=tx_date,txn_type,account,subt_nat_amount` -- all uncleared transactions
   - `reports/TransactionList?cleared=Reconciled&columns=tx_date,account` -- all reconciled transactions

2. **Parse each report** into a `Map<accountName, count>` (for uncleared) and `Map<accountName, latestDate>` (for reconciled), by reading the `account` column from each leaf row's `ColData`.

3. **In the per-account loop**, look up `account.name` in these maps instead of making individual API calls.

4. **Remove** the two per-account `qbFetch` report calls (lines 1006-1033).

This reduces API calls from 2N+1 to 3 total (1 balance query + 2 reports), and actually filters correctly since we do the grouping in code.
