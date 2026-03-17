
Fix the Tasks page crash caused by invalid due dates.

What’s broken
- The `/tasks` page is crashing with `RangeError: Invalid time value`.
- Runtime logs point to `src/pages/Tasks.tsx` where `format(parseDateString(task.due_date), ...)` is called.
- Live task data shows `due_date` values are full timestamps like `2026-03-17T18:54:22.277495+00:00`, not plain `yyyy-MM-dd`.

Root cause
- `parseDateString()` currently does:
  ```ts
  const [year, month, day] = dateStr.split("-").map(Number);
  ```
- That logic only works for plain date strings.
- With timestamp values, the `day` part becomes something like `17T18:54:22...`, producing `NaN`, which then breaks `date-fns/format()`.

Implementation plan

1. Harden date parsing in `src/pages/Tasks.tsx`
- Replace `parseDateString()` with a safe parser that:
  - first tries `new Date(dateStr)`
  - falls back to parsing only the first 10 chars (`yyyy-MM-dd`)
  - returns a valid `Date` only when parsing succeeds

2. Prevent UI crashes anywhere due dates are rendered
- Update all due-date formatting paths in `Tasks.tsx` to use the safe parser consistently:
  - task card due date label
  - overdue checks
  - sorting by due date
  - details drawer due date display
  - calendar selected value
- Add lightweight guards before calling `format()` so one bad value cannot take down the whole page.

3. Keep behavior unchanged for valid dates
- Preserve existing overdue logic, sorting order, and calendar editing behavior.
- No backend/schema changes needed; this is a frontend parsing mismatch.

Files to update
- `src/pages/Tasks.tsx`

Expected result
- The Tasks page loads normally again.
- Existing timestamp-based due dates display correctly.
- Invalid or legacy date values, if any, no longer crash the page.
