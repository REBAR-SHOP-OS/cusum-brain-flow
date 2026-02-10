

# Fix ben@rebar.shop Access: TimeClock, Integrations, and Gauge Agent

## Problems
1. Ben (sales-only role) cannot access `/timeclock` -- gets redirected to `/pipeline`
2. Ben cannot access `/integrations` -- same redirect
3. When Ben asks a question from the Home page, `handleSend` routes to `/agent/estimating` (Gauge), but `/agent` is not in the allowed routes, so RoleGuard kicks him back to `/pipeline`

## Solution
Add the missing route prefixes to the `SALES_ALLOWED` array in `RoleGuard.tsx`.

## Technical Details

### File: `src/components/auth/RoleGuard.tsx`

Add three entries to the `SALES_ALLOWED` array:
- `/timeclock` -- allows time clock access
- `/integrations` -- allows integrations page access
- `/agent` -- allows all AI agent routes (so Gauge and other helpers work from Home)

No other files need changes. The Home page already correctly maps Ben to Gauge (`/agent/estimating`) -- it's just the route guard blocking access.

