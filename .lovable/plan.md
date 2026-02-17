

# Add Date Filter to Customer Transaction List

## What Changes

Add a **Date** filter dropdown to the Transaction List tab in the Customer Detail sheet, matching the QuickBooks date filter shown in the screenshots. This dropdown will include presets like "All", "Today", "This week", "This month", "Last 30 days", "Last 3 months", "Last 6 months", "Last 12 months", "Year to date", "This year", "2025", "2024", "2023", etc.

## Single File Change

### `src/components/customers/CustomerDetail.tsx`

1. **Add state**: `dateFilter` with default `"all"` (line ~87)
2. **Add Date filter Select** after the Status filter (line ~620), with these options:
   - All
   - Today / Yesterday
   - This week / Last week
   - This month / Last month
   - Last 30 days
   - Last 3 months / Last 6 months / Last 12 months
   - Year to date
   - This year / Last year
   - 2025 / 2024 / 2023
3. **Update `filteredTxns` memo** (lines 307-319): add date range filtering logic using `txn.txn_date` against computed start/end dates based on the selected preset
4. **Add `dateFilter` to the `useMemo` dependency array**

## Technical Details

- A helper function `getDateRange(preset: string)` returns `{ start: string; end: string } | null` for each preset, using `date-fns` (already installed) for calculations like `startOfWeek`, `startOfMonth`, `startOfYear`, `subMonths`, `subDays`
- When `dateFilter` is `"all"`, no date filtering is applied (null range)
- Transactions are filtered by comparing `txn.txn_date` against the computed range
- No new files, no new dependencies, no database changes
- The existing Type and Status filters continue to work unchanged alongside the new Date filter

