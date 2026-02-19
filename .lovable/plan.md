

# Match Banking Activity to QuickBooks Layout

## What Changes

The Banking Activity table in the ERP will be updated to exactly match the QuickBooks layout shown in the screenshots.

### Visual Differences to Fix

1. **Add missing "Unaccepted" column** -- QB has 6 columns (Accounts, Bank Balance, In QuickBooks, Unaccepted, Unreconciled, Reconciled Through); ERP only has 5
2. **Change subtitle text** -- from "Synced from QuickBooks. Bank balance is manual entry." to "Estimate the effort to bring these accounts up to date."
3. **Show "X transactions" format** -- Unreconciled and Unaccepted columns should display like "977 transactions" or "0 transactions", not just a number
4. **Account subtitle for non-bank-feed accounts** -- Show "No bank data. QuickBooks transactions only." instead of "Not yet synced. Click Sync QB to pull data."
5. **Remove the icon circle** next to each account name (QB doesn't have it)
6. **Date format** -- Change from MM/dd/yyyy to dd/MM/yyyy to match QB
7. **Keep Sync QB button** but move it to be less prominent (QB doesn't show it but we need the functionality)

---

## Technical Details

### 1. Database Migration
Add `unaccepted_count` column to `qb_bank_activity`:
```sql
ALTER TABLE public.qb_bank_activity
  ADD COLUMN IF NOT EXISTS unaccepted_count integer NOT NULL DEFAULT 0;
```

### 2. Update TypeScript Interface
In `src/hooks/useQBBankActivity.ts`, add `unaccepted_count: number` to the `QBBankActivity` interface.

### 3. Update BankAccountsCard Component
In `src/components/accounting/BankAccountsCard.tsx`:
- Add "Unaccepted" column header between "In QuickBooks" and "Unreconciled"
- Change subtitle text
- Format unreconciled/unaccepted as "X transactions"
- Remove the `Landmark` icon circle from each row
- Change account subtitle to "No bank data. QuickBooks transactions only." for accounts without bank feed
- Change date format to `dd/MM/yyyy`

### 4. Update Sync Engine (if needed)
The `qb-sync-engine` edge function should populate `unaccepted_count` during sync. This will be checked and updated if the field exists in the sync logic.

