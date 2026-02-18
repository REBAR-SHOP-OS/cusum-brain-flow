
# Add "Payroll Summary" Tab to Timeclock Page

## What This Does
Adds a new tab to the Timeclock page (`/timeclock`) that shows each employee's total hours worked in the current payroll cycle, using existing `payroll_weekly_summary` and `payroll_daily_snapshot` tables.

## Scope
Only TWO files will be changed. No other pages, modules, or backend logic will be touched.

---

## Changes

### 1. New Component: `src/components/timeclock/PayrollSummaryTab.tsx`

A new tab component that:
- Fetches the current week's `payroll_weekly_summary` records (joined with `profiles` for names)
- Displays a table/card grid showing per-employee:
  - Name
  - Employee type (salaried/hourly)
  - Regular hours
  - Overtime hours
  - Total paid hours
  - Exceptions count
  - Status (draft / approved / locked)
- Shows a "Current Week" header with the date range
- Falls back to computing hours from `time_clock_entries` if no weekly summary exists yet
- Admin-only: shows all employees. Non-admin: shows only the logged-in user's summary.

### 2. Modified File: `src/pages/TimeClock.tsx`

- Import the new `PayrollSummaryTab` component
- Add a new tab trigger "Payroll" (with a `DollarSign` or `Receipt` icon) to the existing `TabsList`
- Add a new `TabsContent` rendering the `PayrollSummaryTab`
- Pass `isAdmin`, `myProfile`, and `profiles` as props

## Technical Details

### Data Sources (already exist, no DB changes needed)
- `payroll_weekly_summary`: weekly aggregated hours per employee (regular, overtime, total, exceptions, status)
- `payroll_daily_snapshot`: daily breakdowns (clock in/out, lunch deductions, paid minutes, overtime, exceptions)
- `profiles`: employee names and types

### No files modified outside of:
- `src/components/timeclock/PayrollSummaryTab.tsx` (new)
- `src/pages/TimeClock.tsx` (add tab)

### No database changes needed -- all required tables already exist.
