

# Fix Architect Agent: Stop Hallucinating Missing Features + Actually Fix Things

## Problem

The Architect (App Builder) at `/empire` has three critical failures:

1. **Hallucinating missing features**: It told you CoA, P&L, Balance Sheet, AR Aging, Invoice Editor, and Bank Reconciliation are "missing" -- but they ALL already exist. The root cause is the system prompt only lists "Pipeline, Shop Floor, Deliveries, Customers, Inbox, Office Portal, Admin, Brain" as ERP modules. Accounting is completely omitted, so the AI assumes it doesn't exist.

2. **Refuses to fix things**: When asked "CAN YOU ADD THEM", it responded "I cannot directly add or implement". This is because the prompt still encourages creating "fix requests" as the primary action instead of using its direct write tools.

3. **Diagnostics skip accounting**: The `diagnose_platform` tool checks machines, deliveries, tasks, WordPress, and Odoo -- but has ZERO accounting health checks.

## Fix (1 file)

**File: `supabase/functions/ai-agent/index.ts`**

### Change 1: Add complete ERP module inventory to system prompt

Update the "Apps You Manage" section (line 2244) to include ALL modules that actually exist:

```
1. **ERP (REBAR SHOP OS)** — This Lovable app. Modules:
   - Pipeline (CRM/Leads)
   - Shop Floor (Machines, Work Orders, Cut Plans)
   - Deliveries
   - Customers (with QuickBooks sync, detail view, contacts)
   - Inbox (Team Chat, Notifications)
   - Office Portal
   - Admin
   - Brain (Human Tasks, AI Coordination)
   - **Accounting** (already built):
     - Chart of Accounts (CoA) — full QB clone with sync
     - Profit & Loss report — real-time from QuickBooks API
     - Balance Sheet — real-time from QuickBooks API
     - Cash Flow Statement (derived)
     - Trial Balance / Reconciliation checks
     - AR Aging Dashboard (0-30, 31-60, 60+ days)
     - Invoice Editor (dual view/edit, payment history, QB sparse updates)
     - Vendor/Bill management
     - Customer management (shared with /customers module)
     - QB Sync Engine (on-demand per entity type)
   - **Estimation** (Cal agent — quotes, takeoffs, templates)
   - **HR** (Leave requests, timeclock, payroll)
   - **SEO Dashboard**
```

### Change 2: Add anti-hallucination rule to system prompt

Add a new mandatory rule section:

```
## CRITICAL: Do NOT Hallucinate Missing Features
Before claiming ANY feature is "missing" from the ERP, you MUST:
1. Check your module inventory above
2. Ask the user to confirm if the feature exists
3. NEVER claim a feature is missing unless you have concrete evidence

Features that ALREADY EXIST and must NOT be reported as missing:
- Chart of Accounts, P&L, Balance Sheet, Cash Flow, Trial Balance
- AR Aging, Invoice Editor, Vendor Management
- Bank/QB Reconciliation (via trial_balance_checks table)
- Customer Detail view, Contact management
- Pipeline/CRM, Shop Floor, Deliveries, HR, SEO

## CRITICAL: You CAN and MUST Fix Things Directly
You have direct read AND write tools for ERP, WordPress, and Odoo.
When asked to fix something or add something, USE YOUR TOOLS. 
NEVER say "I cannot directly add or implement".
NEVER say "I will create fix requests for your development team".
You ARE the development team for operational fixes.
Only create vizzy_fix_requests for issues requiring frontend code changes 
that are outside your tool capabilities.
```

### Change 3: Add accounting diagnostics to `diagnose_platform`

After the existing ERP diagnostics (line 6857), add accounting health checks:

- Check for QB sync freshness (last `qb_transactions` entry date)
- Check trial balance status (`trial_balance_checks` table for failures)
- Check for un-synced customers (customers without `quickbooks_id`)
- Check for stale overdue invoices (invoices with balance > 0 and past due > 90 days)
- Check QB token health (look for recent auth errors)

### Change 4: Add accounting context to empire agent

In the empire context-fetching block (around line 3340), add:

- Fetch open invoice count and total AR balance from `qb_transactions`
- Fetch last QB sync timestamp
- Fetch trial balance check results
- Pass as `context.accountingHealth`

This gives the Architect grounded data about accounting state so it doesn't have to guess.

## Summary of Changes

| Location | Change |
|----------|--------|
| System prompt (line 2244) | Add complete module inventory including Accounting |
| System prompt (new section) | Add anti-hallucination rules and "you MUST fix directly" mandate |
| `diagnose_platform` handler (line 6857) | Add 5 accounting health checks |
| Empire context block (line 3340) | Add accounting context data (AR balance, sync freshness, trial balance) |

## Expected Result

After this fix:
- Architect will never again claim CoA, P&L, Balance Sheet, AR Aging, etc. are "missing"
- When asked to fix something, it will USE its tools instead of saying "I cannot"
- `diagnose_platform` will include accounting health in its reports
- The only legitimately missing features (Job Costing Dashboard, Holdback Tracking) will be correctly identified as gaps

