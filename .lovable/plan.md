

# Fix Watchdog SMS Spam — Only Send Truly Critical Alerts

## Problem
The `vizzy-business-watchdog` function generates hundreds of alerts (492 in screenshot) because `checkAtRiskProduction` creates an alert for **every** cut_plan_item with <50% progress (up to 200 items × multiple admins). All "high" priority alerts trigger SMS to the CEO, flooding his phone with repetitive "At-risk production: 10M" messages.

## Root Cause
1. `checkAtRiskProduction` has no aggregation — each individual item becomes a separate alert
2. The SMS threshold is too broad: any `priority: "high"` alert triggers SMS
3. No daily SMS cap — every 15-min cron run can send new SMS if dedupe keys are fresh

## Solution

### `supabase/functions/vizzy-business-watchdog/index.ts`

**1. Aggregate production alerts instead of per-item spam**
Replace the per-item loop in `checkAtRiskProduction` with a single summary alert:
- Count total at-risk items and group by phase
- Create ONE alert per admin: "X production items at risk (Y cutting, Z bending)"
- Single dedupe key per day: `atrisk-prod-summary-{today}`

**2. Restrict SMS to only security/safety/delivery-critical alerts**
Change the SMS filter (lines 80-89) to only send SMS for:
- `broken-int-*` (integration failures — security/operational)
- `missed-delivery-*` (customer-facing urgency)
- `long-shift-*` (employee safety)

Remove production and stalled-lead alerts from SMS triggers. These remain as in-app notifications but stop flooding the CEO's phone.

**3. Add daily SMS cap**
Before sending SMS, check how many watchdog SMS were sent today (query `communications` or add a simple counter). Cap at **3 SMS per day** from watchdog. After that, only log to notifications.

### Summary of behavior after fix
- Production: 1 summary notification per day (not 200+ individual ones), **no SMS**
- Stalled leads: notifications only, **no SMS**  
- Overdue invoices: notifications only, **no SMS**
- Broken integrations: notification + SMS (critical)
- Missed deliveries: notification + SMS (critical)
- Long shifts: notification + SMS (safety)
- Unanswered emails: notifications only, **no SMS**
- Daily SMS cap: max 3 from watchdog

## Impact
- Single file changed (`vizzy-business-watchdog/index.ts`)
- No database changes
- Dramatically reduces alert noise and eliminates SMS spam

