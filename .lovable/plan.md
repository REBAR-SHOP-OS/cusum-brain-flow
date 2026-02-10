

## Payroll Audit — Full Rebuild

Replace the static mock `PayrollAuditView` with a production-grade, Ontario-compliant payroll audit system. This requires new database tables, an edge function for payroll computation, and a completely new multi-tab UI.

---

### Phase 1: Database Migration

Create the payroll tables that were planned but never built:

**`payroll_daily_snapshot`**
- `id`, `profile_id` (FK profiles), `work_date` (date), `employee_type` (text: office/workshop)
- `raw_clock_in` (timestamptz), `raw_clock_out` (timestamptz)
- `lunch_deducted_minutes` (int, default 30), `paid_break_minutes` (int, default 0)
- `expected_minutes` (int, default 510 = 8.5hrs), `paid_minutes` (int)
- `overtime_minutes` (int, default 0)
- `exceptions` (jsonb, default '[]'), `ai_notes` (text)
- `status` (text: auto/reviewed/approved, default 'auto')
- `approved_by` (uuid, nullable), `approved_at` (timestamptz, nullable)
- `company_id` (uuid), `created_at`
- RLS: admins read/write all in company, employees read own

**`payroll_weekly_summary`**
- `id`, `profile_id`, `week_start` (date), `week_end` (date), `employee_type`
- `total_paid_hours` (numeric), `regular_hours` (numeric), `overtime_hours` (numeric)
- `total_exceptions` (int), `status` (text: draft/approved/locked, default 'draft')
- `approved_by`, `approved_at`, `locked_at`, `company_id`, `created_at`
- RLS: same pattern

**`payroll_audit_log`**
- `id`, `actor_id` (uuid), `action` (text), `entity_type` (text), `entity_id` (uuid)
- `before_data` (jsonb), `after_data` (jsonb), `reason` (text), `company_id`, `created_at`
- RLS: admin-only read, insert via trigger/service role

Add `employee_type` column to `profiles` table (text, nullable, values: 'office' or 'workshop') so each person's work rules are explicit.

Enable realtime on `payroll_daily_snapshot`.

---

### Phase 2: Payroll Engine (Edge Function)

**New: `supabase/functions/payroll-engine/index.ts`**

Called to compute a week's payroll for a company. For each employee with `time_clock_entries` in the date range:

1. Determine `employee_type` from `profiles.employee_type` (fall back to department: office -> office, workshop/field -> workshop)
2. For each work day, find the clock-in/out pair
3. Apply locked rules:
   - **Office**: gross = clock_out - clock_in, deduct 30min lunch, paid = gross - 30min. Expected = 510min.
   - **Workshop**: gross = clock_out - clock_in, deduct 30min lunch, add 30min paid breaks implicitly. paid = gross - 30min. Expected = 510min.
4. Detect exceptions:
   - Missing punch (clock_in with no clock_out, or no entry for a weekday)
   - Early/late punch (outside allowed windows)
   - Daily paid hours not equal to 8.5
   - Lunch overlap detection
5. Calculate weekly overtime: if total paid hours > 44, excess = overtime
6. Generate AI notes per employee (short, actionable text)
7. Upsert into `payroll_daily_snapshot` and `payroll_weekly_summary`

Uses Lovable AI (`gemini-2.5-flash`) for AI notes generation.

---

### Phase 3: UI Rebuild

**Rewrite `src/components/office/PayrollAuditView.tsx`** with tabbed layout:

**Tab 1: Overview (Default)**
- Week selector (Mon-Sun, defaults to current week)
- 5 summary cards: Total Employees, Total Paid Hours, Overtime Hours, Exceptions, Compliance Status (PASS/REVIEW)
- Employee payroll table with columns: Name, Role (Office/Workshop), Expected Hrs, Actual Paid Hrs, Regular Hrs, OT Hrs, Exceptions, Status (Clean/Needs Review/Blocked)
- Row click expands daily breakdown
- "Compute Payroll" button to trigger the edge function
- "Approve All Clean" bulk action
- "Lock Week" button (makes snapshot read-only)

**Tab 2: Exceptions**
- Filtered list showing ONLY employees/days with issues
- Each exception card shows: Date, Employee, What happened, AI suggestion, Confidence %, Action buttons (Approve/Reject/Ask Employee)
- Exception types: missed punch, early/late, lunch overlap, hours mismatch, OT threshold

**Tab 3: Compliance**
- Ontario compliance checklist (automated):
  - Unpaid lunch enforced on all 5h+ shifts
  - No time rounding detected
  - Overtime paid after 44h/week
  - No manual edits without approval
  - Paid breaks correct for workshop
- Each item shows PASS (green) or FAIL (red)
- If any FAIL exists, payroll cannot be locked

**Tab 4: History**
- List of previously locked weeks
- Each shows: week range, total payroll hours, status badge
- Click to view read-only snapshot
- Export buttons (CSV, PDF)

**Header actions:**
- Week picker (prev/next arrows + date display)
- Export dropdown (CSV, PDF, Audit Log)
- Lock Payroll button

---

### New Files

| Action | File |
|--------|------|
| Migration | New tables + profiles column |
| New | `supabase/functions/payroll-engine/index.ts` |
| Rewrite | `src/components/office/PayrollAuditView.tsx` |
| New | `src/hooks/usePayrollAudit.ts` (fetches snapshots, triggers engine, approve/lock actions) |
| New | `src/components/office/payroll/PayrollOverviewTab.tsx` |
| New | `src/components/office/payroll/PayrollExceptionsTab.tsx` |
| New | `src/components/office/payroll/PayrollComplianceTab.tsx` |
| New | `src/components/office/payroll/PayrollHistoryTab.tsx` |
| New | `src/components/office/payroll/PayrollEmployeeRow.tsx` |
| New | `src/components/office/payroll/PayrollExportDialog.tsx` |

---

### Design Principles Applied

- Managers see exceptions only -- clean employees are green-lit automatically
- Raw punch data (`time_clock_entries`) is never modified
- All approvals and locks are logged in `payroll_audit_log`
- Ontario compliance is checked as hard gates before locking
- Locked payroll becomes immutable source of truth
- Follows the existing Office Portal visual style (dark theme, uppercase headers, tracking-widest labels)
