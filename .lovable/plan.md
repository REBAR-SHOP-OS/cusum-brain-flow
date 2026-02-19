

# Mirror Banking Activity to QuickBooks -- Exact Layout Match

## Current State
The data values in the ERP now match QuickBooks correctly. The remaining work is to make the **layout and formatting** an exact mirror of QB.

## Differences to Fix

| Element | QuickBooks | ERP (Current) |
|---------|-----------|---------------|
| Columns | 6 (Accounts, Bank Balance, In QuickBooks, Unaccepted, Unreconciled, Reconciled Through) | 5 (missing Unaccepted) |
| Unreconciled format | Shows as plain number (e.g. "34") | Shows as plain number -- OK |
| Reconciled Through | "Never reconciled" | "Never reconciled" -- OK |
| Account icon | House/bank icon | Round circle with Landmark icon -- needs simplification |
| Subtitle | "Estimate the effort to bring these accounts up to date." | "Synced from QuickBooks. Bank balance is manual entry." |

## Changes

### 1. Database: Add `unaccepted_count` column
Add integer column to `qb_bank_activity` with default 0. The sync engine already exists and will be updated to populate this.

### 2. Frontend: `BankAccountsCard.tsx`
- Add "Unaccepted" column header between "In QuickBooks" and "Unreconciled"
- Add unaccepted count cell for each row
- Change subtitle to "Estimate the effort to bring these accounts up to date."
- Remove the round primary-colored circle around the Landmark icon (keep just the icon)

### 3. Hook: `useQBBankActivity.ts`
- Add `unaccepted_count: number` to the `QBBankActivity` interface

### 4. Sync Engine: `qb-sync-engine/index.ts`
- Add `unaccepted_count` field to the upsert payload (currently defaults to 0, will be populated when QB API provides the data)

