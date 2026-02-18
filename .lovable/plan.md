
# Corporate Tax Optimization — CPA Playbook (Canada)

A new "Tax Planning" module inside the Accounting workspace that brings the entire CPA playbook to life with interactive calculators, checklists, and tracking tools.

---

## What Gets Built

### 1. Tax Planning Dashboard (Main Tab)
A single-page command center with cards for each pillar of the playbook:
- **Owner Pay Strategy** — Salary vs. Dividend calculator with real-time comparison
- **Corporate Retention** — Visual gauge showing retained earnings vs. withdrawals, with deferral savings estimate
- **HSA Tracker** — Health Spending Account status, annual limit, and claimed-to-date
- **Expense Maximization** — Checklist of CRA-safe deduction categories with claimed/unclaimed status
- **CCA Schedule** — Depreciation planner showing available CCA by asset class, with "use this year" toggles
- **GST/HST ITC Review** — Summary of claimed vs. eligible Input Tax Credits
- **Vicky Task List** — The 5 CPA tasks from the playbook, tracked with status (To Do / In Progress / Done)

### 2. Salary vs. Dividend Calculator
Interactive tool with inputs:
- Corporate net income
- Personal other income
- RRSP room needed (yes/no + amount)
- CPP benefit desired (yes/no)

Outputs a side-by-side comparison:
- Total tax paid (corp + personal) under salary-only, dividend-only, and blended scenarios
- Uses Ontario 2024/2025 brackets, SBD rate (~12.2%), eligible/non-eligible dividend gross-up and tax credits
- Shows the "optimal split" recommendation

### 3. Year-End Tax Playbook
A guided checklist organized by quarter:
- Q3: Review CCA schedule, estimate year-end profit
- Q4: Finalize expense claims, decide salary vs. dividend timing
- Year-End: HSA top-up, dividend declaration, RRSP contribution
- Post Year-End: T2 prep checklist, GST/HST annual review

### 4. Profit Retention Policy
Configurable rules:
- Minimum retained earnings target
- Maximum annual withdrawal percentage
- "How much can I pull out?" calculator based on current retained earnings, upcoming obligations, and tax bracket optimization

---

## Database Tables (1 migration)

### `tax_planning_profiles`
Stores per-company tax configuration:
- `company_id`, `fiscal_year`
- `owner_pay_strategy` (salary_first / dividend_first / blended)
- `hsa_annual_limit`, `hsa_claimed_ytd`
- `target_retained_earnings`, `max_withdrawal_pct`
- `sbr_rate`, `personal_bracket_estimate`
- `notes`, timestamps

### `tax_planning_tasks`
The Vicky task list + year-end playbook items:
- `company_id`, `fiscal_year`
- `title`, `description`, `category` (owner-pay / expenses / hsa / cca / gst-hst / year-end)
- `status` (todo / in_progress / done)
- `due_date`, `assigned_to`, `completed_at`
- timestamps

### `tax_deduction_tracker`
Expense maximization checklist:
- `company_id`, `fiscal_year`
- `category` (home-office / phone / software / professional / banking / insurance / education / other)
- `description`, `estimated_amount`, `claimed_amount`
- `is_claimed` boolean
- timestamps

### `cca_schedule_items`
Capital Cost Allowance planning:
- `company_id`, `fiscal_year`
- `asset_description`, `cca_class`, `ucc_opening`, `additions`, `dispositions`
- `cca_rate`, `cca_claimed`, `ucc_closing`
- `use_this_year` boolean
- timestamps

All tables scoped by `company_id` with RLS policies.

---

## New Files

| File | Purpose |
|------|---------|
| `src/hooks/useTaxPlanning.ts` | Hook for tax_planning_profiles CRUD |
| `src/hooks/useTaxTasks.ts` | Hook for tax_planning_tasks CRUD |
| `src/hooks/useTaxDeductions.ts` | Hook for tax_deduction_tracker CRUD |
| `src/hooks/useCCASchedule.ts` | Hook for cca_schedule_items CRUD |
| `src/components/accounting/TaxPlanning.tsx` | Main dashboard with all cards |
| `src/components/accounting/tax/SalaryDividendCalculator.tsx` | Interactive calculator |
| `src/components/accounting/tax/YearEndPlaybook.tsx` | Guided checklist |
| `src/components/accounting/tax/ProfitRetentionPolicy.tsx` | Withdrawal calculator |
| `src/components/accounting/tax/HSATracker.tsx` | HSA card component |
| `src/components/accounting/tax/CCAPlanner.tsx` | CCA schedule manager |
| `src/components/accounting/tax/DeductionChecklist.tsx` | Expense maximization |
| `src/components/accounting/tax/VickyTaskList.tsx` | CPA task tracker |
| `src/lib/tax/canadianTaxRates.ts` | Ontario/Federal tax brackets, SBD rate, dividend gross-up constants |
| `src/lib/tax/taxCalculator.ts` | Pure functions for salary vs dividend math |

## Modified Files

| File | Change |
|------|--------|
| `AccountingNavMenus.tsx` | Add "Tax Planning" item under Accounting menu |
| `AccountingWorkspace.tsx` | Add `tax-planning` tab routing to `TaxPlanning` component |

---

## Tax Calculator Logic (Ontario, Canada)

The calculator uses deterministic, rule-based math:

- **Federal SBD rate**: 9% (first $500K active business income)
- **Ontario small business rate**: 3.2%
- **Combined corp rate**: ~12.2%
- **Eligible dividend gross-up**: 38%, federal credit 15.0198%, Ontario credit 10%
- **Non-eligible dividend gross-up**: 15%, federal credit 9.0301%, Ontario credit 2.9863%
- **CPP max contribution** (employee): ~$3,867
- **Federal/Ontario personal brackets**: Built-in 2024/2025 tables
- **Basic personal amount**: Federal $15,705 / Ontario $11,865

The calculator compares 3 scenarios and shows total combined tax (corporate + personal) for each.

---

## Implementation Order

1. Database migration (4 tables + RLS)
2. Tax rate constants and calculator functions
3. Hooks (4 files)
4. UI components (8 files)
5. Wire into nav menu and workspace routing
6. Pre-seed Vicky's 5 tasks on first load
