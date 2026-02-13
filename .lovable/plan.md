

# Time Clock Enhancement — Leave Requests, Sick Days, Vacation Calculator

## Current State

The Time Clock system has:
- Clock in/out with face recognition and kiosk mode
- Real-time team status board
- Payroll audit with Ontario ESA compliance
- `time_clock_entries` table (clock_in, clock_out, break_minutes, notes)
- `employee_salaries` table (salary_amount, salary_type)

**Missing entirely:**
- No leave/time-off request system
- No sick day tracking
- No vacation entitlement calculation
- No approval workflow for time off
- No balance tracking (days used vs. available)

---

## What We Will Build

### 1. Database Tables

**`leave_balances`** — Each employee's annual entitlements
- profile_id, year, vacation_days_entitled, vacation_days_used, sick_days_entitled, sick_days_used, personal_days_entitled, personal_days_used, company_id
- Auto-populated based on Ontario ESA rules (2 weeks minimum vacation after 1 year, 3 weeks after 5 years)

**`leave_requests`** — Individual time-off requests
- profile_id, leave_type (vacation / sick / personal / bereavement / unpaid), start_date, end_date, total_days, reason, status (pending / approved / denied / cancelled), reviewed_by, reviewed_at, company_id

### 2. Ontario ESA Vacation Calculator

Automatically calculates entitlements based on:
- **Vacation**: 2 weeks (10 days) after 1 year of employment, 3 weeks (15 days) after 5+ years
- **Sick days**: 3 unpaid sick days per year (ESA minimum)
- **Personal emergency leave**: 2 days per year
- Vacation pay: 4% of gross earnings (under 5 years) or 6% (5+ years)
- Integrates with `employee_salaries` to show vacation pay amounts

### 3. New UI Tabs on Time Clock Page

Add a **tabbed interface** below the clock-in card:

**Tab: Team Status** (existing team grid, moved into tab)

**Tab: My Leave**
- Balance cards: Vacation (X/Y days), Sick (X/Y days), Personal (X/Y days)
- Calendar view showing booked days
- "Request Time Off" button opening a dialog form
- List of my past/pending requests with status badges

**Tab: Team Calendar** (admin/manager view)
- Calendar grid showing who is off on which days
- Pending requests requiring approval with approve/deny buttons
- Summary stats: how many people off today, upcoming leaves

### 4. Request Workflow

- Employee submits request (leave type, dates, reason)
- Request appears as "Pending" with yellow badge
- Admin sees pending requests in Team Calendar tab
- Admin approves or denies with optional note
- On approval: balance is automatically decremented
- On denial: employee gets notification via toast
- Realtime updates via Supabase channel subscription

### 5. Payroll Integration

- When payroll engine runs, it checks `leave_requests` for the week
- Sick/personal days flagged as exceptions in payroll snapshots
- Vacation days calculate vacation pay based on salary

---

## Technical Details

### New Database Migration

```text
leave_balances:
  id (uuid, PK, default gen_random_uuid())
  profile_id (uuid, FK to profiles, NOT NULL)
  year (integer, NOT NULL, default extract(year from now()))
  vacation_days_entitled (numeric, default 10)
  vacation_days_used (numeric, default 0)
  sick_days_entitled (numeric, default 3)
  sick_days_used (numeric, default 0)
  personal_days_entitled (numeric, default 2)
  personal_days_used (numeric, default 0)
  company_id (uuid, NOT NULL)
  created_at (timestamptz, default now())
  updated_at (timestamptz, default now())
  UNIQUE(profile_id, year)

leave_requests:
  id (uuid, PK, default gen_random_uuid())
  profile_id (uuid, FK to profiles, NOT NULL)
  leave_type (text, NOT NULL) -- vacation, sick, personal, bereavement, unpaid
  start_date (date, NOT NULL)
  end_date (date, NOT NULL)
  total_days (numeric, NOT NULL, default 1)
  reason (text)
  status (text, NOT NULL, default 'pending') -- pending, approved, denied, cancelled
  reviewed_by (uuid, FK to profiles, nullable)
  reviewed_at (timestamptz, nullable)
  review_note (text, nullable)
  company_id (uuid, NOT NULL)
  created_at (timestamptz, default now())
  updated_at (timestamptz, default now())
```

- RLS policies: employees see own data + admins see all company data
- Validation trigger: ensure leave_type and status are valid values
- Trigger: on leave_request status change to 'approved', auto-update leave_balances
- Enable realtime on both tables

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useLeaveManagement.ts` | Hook for fetching balances, requests, CRUD operations |
| `src/components/timeclock/LeaveBalanceCards.tsx` | Visual balance cards (vacation/sick/personal with progress rings) |
| `src/components/timeclock/LeaveRequestDialog.tsx` | Form dialog to submit a new leave request |
| `src/components/timeclock/MyLeaveTab.tsx` | "My Leave" tab content |
| `src/components/timeclock/TeamCalendarTab.tsx` | Admin team calendar with approval workflow |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/TimeClock.tsx` | Add Tabs component wrapping Team Status + My Leave + Team Calendar |
| `src/hooks/useTimeClock.ts` | No changes needed (clock entries remain separate) |

### Vacation Pay Calculation Logic

```text
if employment_years < 5:
  vacation_pay = annual_salary * 0.04
  entitled_days = 10
else:
  vacation_pay = annual_salary * 0.06
  entitled_days = 15
```

This runs client-side using data from `employee_salaries` and `profiles.created_at`.

