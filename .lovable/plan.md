

# Fix: Penny Can't Show Monthly P&L Data

## Problem

Penny fetches the Profit & Loss report from QuickBooks with `summarize_column_by=Year`, which returns only yearly totals. When you ask for "December 2025", Penny has no monthly breakdown to extract from, so it returns all zeros.

The system prompt even tells Penny to "extract the relevant month's column" -- but that column doesn't exist in the data it receives.

## Fix

**Single change in `supabase/functions/ai-agent/index.ts` (line 2047)**

Change the P&L API call from:

```
summarize_column_by=Year
```

to:

```
summarize_column_by=Month
```

This gives Penny monthly columns so it can correctly extract any specific month's revenue, expenses, and net income.

## What Changes

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Line 2047: `Year` to `Month` in the P&L API query parameter |

One word changed. No database or frontend changes needed.

