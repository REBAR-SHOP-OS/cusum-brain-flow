

# Fix Banking Activity — Wrong Numbers (3 Issues)

## Problems Identified

The screenshot from QuickBooks shows three values that don't match the ERP:

| Field | QuickBooks Shows | ERP Shows | Root Cause |
|-------|-----------------|-----------|------------|
| In QuickBooks | $22,037.53 | $32,035.28 | Using stale cached balance from `qb_accounts` table instead of fetching live from QB API |
| Unreconciled | 977 transactions | 34 | Counting section headers instead of actual transaction rows (QB reports nest rows inside sections) |
| Reconciled Through | 31/10/2025 | -- (nil) | Report query likely failing or returning grouped structure that isn't being parsed correctly |

---

## Fix 1: Ledger Balance — Fetch Live from QB API

**Current**: Line 1008 uses `account.current_balance` from the cached `qb_accounts` table, which may be stale.

**Fix**: During the bank-activity sync, fetch each bank account directly from the QB API (`Account/{id}`) to get the real-time `CurrentBalance`, instead of relying on the cached table.

---

## Fix 2: Unreconciled Count — Recursively Count Transaction Rows

**Current**: Line 956 does `unreconciledCount = rows.length` which counts top-level elements. But QB TransactionList reports group transactions into sections, where each section has nested `Rows.Row` arrays containing the actual transactions.

**Fix**: Add a recursive row counter that walks the nested report structure (same pattern already used in `quickbooks-oauth/index.ts` at line 1559) to count only leaf data rows (those with `ColData`), not section headers.

---

## Fix 3: Reconciled Through Date — Fix Report Parsing

**Current**: The reconciled report query uses `limit=1` which is not a valid QB report parameter, and it tries to parse just the first row's `ColData` — but that first "row" is likely a section header, not a data row.

**Fix**: Remove the invalid `limit=1` parameter. Recursively walk all reconciled transaction rows to extract dates from `ColData`, then find the maximum date as the "reconciled through" date.

---

## Technical Changes

### File: `supabase/functions/qb-sync-engine/index.ts`

1. Add a helper function `countReportDataRows(rows)` that recursively counts leaf rows (rows with `ColData` but no nested `Rows.Row`)

2. Add a helper function `extractMaxDateFromReport(rows)` that recursively walks all leaf rows and finds the maximum date value

3. Update the unreconciled section (~line 948-959):
   - Replace `rows.length` with `countReportDataRows(rows)`

4. Update the ledger balance fetch (~line 941-1008):
   - Before the upsert, fetch the account from QB API: `Account/${account.qb_id}`
   - Use the live `CurrentBalance` instead of the cached `account.current_balance`

5. Update the reconciled section (~line 962-994):
   - Remove invalid `limit=1` parameter
   - Use `extractMaxDateFromReport(rows)` to find the latest reconciled date

No database or frontend changes needed — the issue is entirely in the sync engine's data collection logic.

