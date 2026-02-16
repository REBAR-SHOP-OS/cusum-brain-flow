
# CEO Business Heartbeat Dashboard

## Overview

Create a new dedicated "Business Heartbeat" page within the CEO Portal that consolidates everything into a single real-time command center: online visitors, team presence, customer origins, spending breakdown, productivity metrics, and live website activity.

## What You'll See

### Section 1: Live Pulse Strip (Top)
- **Website Visitors Now**: Count of active support chat visitors (online within 60s) with green pulsing dot
- **Team On Clock**: Staff currently clocked in vs total, with percentage
- **Machines Running**: Live count with status breakdown
- **Open Conversations**: Active support chats happening right now
- **Orders Today**: New orders created today
- **Leads Today**: New leads captured today

### Section 2: Customer Origins Map
- A visual card showing where website visitors and leads come from:
  - **Live Visitors by City**: Pulled from `support_conversations.metadata` (city/country from IP geolocation we just built)
  - **Lead Sources**: Breakdown of lead sources (website, email, AI prospecting, referral) as a horizontal bar chart
  - Shows city names with visitor counts and country flags

### Section 3: Online/Offline Status Board
- **Team Presence**: Each team member with green (clocked in) / grey (off) dot, clock-in time, and role
- **Machine Fleet**: Each machine with status dot (running/idle/blocked/down) and current job
- **Website Widget**: Active visitor sessions with their current page and city

### Section 4: Where Money Is Going (Spending Breakdown)
- **Outstanding Payables**: Total vendor bills from `accounting_mirror` (entity_type = 'Vendor')
- **Outstanding Receivables**: Invoice totals with aging buckets (already computed)
- **Pipeline by Stage**: Funnel visualization of leads from new to won
- **Revenue Concentration**: Top 5 customers by order value

### Section 5: Productivity Metrics
- **Production Throughput**: Pieces completed today vs target, with 7-day trend sparkline
- **Machine Utilization**: OEE-style gauge per machine
- **Quote Turnaround**: Average time from lead creation to quote sent
- **Team Productivity**: Clock hours today, pieces per labor hour

### Section 6: Activity Feed
- Live scrolling feed of recent `activity_events` (last 24h) showing what's happening across the business: new leads, orders, chat sessions, machine runs, deliveries

## Technical Details

### New Files
| File | Purpose |
|------|---------|
| `src/components/ceo/BusinessHeartbeat.tsx` | Main heartbeat dashboard component |
| `src/hooks/useBusinessHeartbeat.ts` | Data hook querying all live data sources |

### Modified Files
| File | Change |
|------|--------|
| `src/pages/CEOPortal.tsx` | Add BusinessHeartbeat as a tab or top section |

### Data Sources (all existing tables, no migrations needed)

- `support_conversations` -- live visitor sessions with metadata (city, current_page, last_seen_at)
- `time_clock_entries` -- team clock in/out
- `machines` + `machine_runs` -- equipment status and utilization
- `leads` -- pipeline stages, sources, counts
- `orders` -- revenue, recent orders
- `accounting_mirror` -- AR/AP totals (Invoice + Vendor entity types)
- `profiles` + `user_roles` -- team member info
- `activity_events` -- live event feed
- `customers` -- customer base metrics
- `cut_plan_items` -- production progress

### Hook Design (`useBusinessHeartbeat`)

Single `useQuery` that fetches all data in parallel:
1. Active visitors: `support_conversations` where `metadata->last_seen_at` is within 5 minutes
2. Team presence: `time_clock_entries` joined with `profiles` for today, checking who has `clock_out IS NULL`
3. Machine status: `machines` table
4. Lead sources: `leads` grouped by `source`
5. Lead pipeline: `leads` grouped by `stage`
6. Spending: `accounting_mirror` grouped by `entity_type`
7. Recent activity: `activity_events` last 24h, limit 20
8. Today's production: `machine_runs` and `cut_plan_items` for today

Auto-refresh every 30 seconds using `refetchInterval: 30000`.

### Online Visitor Detection

Uses the heartbeat system we just built:
- Query `support_conversations` where `metadata->>'last_seen_at'` is within the last 60 seconds = Online
- 1-5 minutes = Away
- Older = Offline
- Display city from `metadata->>'city'`

### No Database Migrations Required

All data sources already exist. This is purely a frontend dashboard with a new data hook.
