## Bug

In `src/pages/Tasks.tsx`, editing a task's due date appears flaky: the calendar highlights the wrong day, the detail panel sometimes shows the previous day, and the audit log records "no-op" reschedules like `2026-05-23 → 2026-05-23`.

## Root Cause

`parseDateString` (line 186) calls `new Date("2026-05-23")` first. JavaScript parses a bare `YYYY-MM-DD` string as **UTC midnight**, which in America/Toronto (UTC−4/−5) renders as the **previous calendar day**. The local-date fallback on line 189 is never reached for the common case.

Consequences:
- The Calendar's `selected={parseDateString(due_date)}` highlights the day before the stored date.
- The display `format(parseDateString(due_date), "MMM d, yyyy")` shows the day before.
- User clicks the "correct" day in the picker (which is actually the same day already stored) → DB write is a no-op → audit row reads `2026-05-23 → 2026-05-23`.
- Mixed legacy values stored as full ISO (`2026-05-30T00:00:00+00:00`) interact with new `yyyy-MM-dd` writes, producing the second audit line the screenshot shows.

The same helper feeds `isOverdue`, the card list (`line 1217`), and sort order — so overdue badges and ordering can also be off by one near midnight.

## Fix (surgical, single file)

Edit only `src/pages/Tasks.tsx`:

1. **Rewrite `parseDateString`** to treat any `YYYY-MM-DD` prefix as a local-time date, and only fall through to `new Date(...)` for full ISO timestamps:
   ```ts
   function parseDateString(dateStr: string): Date {
     const m = dateStr.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
     if (m) {
       const [, y, mo, d] = m;
       return new Date(Number(y), Number(mo) - 1, Number(d));
     }
     const d = new Date(dateStr);
     return isNaN(d.getTime()) ? new Date(NaN) : d;
   }
   ```
2. **Line 1519 fallback render**: replace `new Date(selectedTask.due_date)` with `parseDateString(selectedTask.due_date)` so the read-only branch uses the same local-date logic.
3. **Calendar `onSelect` (line 1488)**: guard against no-op writes — if `newDate === oldDate`, close the popover without hitting the DB or writing an audit row. Prevents future phantom `X → X` audit entries even if data drifts.

No schema, RLS, or other component changes.

## Out of Scope

- Backfilling legacy `due_date` values stored as full ISO timestamps (display will now be correct regardless).
- Changes to `useProjectTasks`, `useAgentDomainDrilldown`, or other consumers.
- Audit-log UI changes.

## Verification

1. Open a task whose `due_date` is `YYYY-MM-DD` → detail panel and calendar both show the same correct day.
2. Pick a new day → toast "Due date updated", audit log shows `old → new` with different dates.
3. Re-open the picker and click the currently selected day → popover closes, no toast, no new audit row.
4. Clear date → toast "Due date cleared", audit log shows `old → null`.
5. Cards in the column show the same `MMM d` as the detail panel.
