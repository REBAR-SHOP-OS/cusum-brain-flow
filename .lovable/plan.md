
# Advanced CEO Dashboard Upgrade

## Overview
Redesign the CEO Dashboard into a more advanced, data-rich executive command center with new metrics, improved visuals, and additional sections that give you full operational visibility at a glance.

## New Features and Enhancements

### 1. Enhanced Header with Greeting and Health Score
- Dynamic greeting based on time of day ("Good morning, CEO")
- Overall business health score (0-100) calculated from production progress, AR ratio, machine uptime, and pipeline velocity
- Animated health ring indicator (green/amber/red)
- Last refresh timestamp with manual refresh button

### 2. Expanded KPI Hero Strip (6 cards instead of 4)
- Active Orders (existing)
- Machines Running (existing)
- Run Time Today (existing)
- Pipeline Value (existing)
- **NEW: Today's Revenue** - sum of invoices paid today
- **NEW: Team On Clock** - workers clocked in vs total, with percentage

### 3. Production Pulse - Enhanced
- Keep existing progress bar and machine fleet grid
- **NEW: Tonnage tracker** - total weight produced today from machine runs
- **NEW: Scrap rate indicator** - scrap qty vs output qty percentage
- Color-coded machine cards with animated pulse for running machines

### 4. Financial Health - Enhanced
- Keep existing 4 metric tiles
- **NEW: Overdue invoices count** (invoices past due date)
- **NEW: Cash flow indicator** - simple AR vs recent payments trend arrow
- Add sparkline mini-charts inside metric tiles

### 5. NEW: Operations Command Strip (expanded from 5 to 6)
- Deliveries, Pickups, Comms Today, Social Posts, Team (existing)
- **NEW: Open Tasks** - count from any tasks table if available

### 6. Charts Section - Enhanced
- 7-Day Machine Activity (existing, keep as-is)
- Sales Pipeline horizontal bar (existing, keep as-is)
- **NEW: Production vs Target donut chart** - pieces completed vs total target
- **NEW: Revenue trend line** - 7-day invoice/payment trend if data available

### 7. Recent Orders - Enhanced
- Add order date column
- Add total value summary row at bottom
- Clickable rows (future navigation)

### 8. NEW: Alerts and Notifications Banner
- Top-of-dashboard alert strip for critical items:
  - Machines down
  - Overdue deliveries
  - Large unpaid invoices (over threshold)
- Dismissable, color-coded (red for critical, amber for warning)

---

## Technical Details

### Files Modified
1. **`src/hooks/useCEODashboard.ts`**
   - Add new metrics to `CEOMetrics` interface: `healthScore`, `tonnageToday`, `scrapRate`, `overdueInvoices`, `tasksOpen`, `teamOnClockPercent`, `alerts`
   - Expand `fetchCEOMetrics` with additional queries for scrap data, overdue invoices, and alert conditions
   - Calculate composite health score from weighted factors

2. **`src/components/office/CEODashboardView.tsx`**
   - Complete redesign of the view component with:
     - Greeting header with health score ring
     - 6-card KPI strip (3x2 on mobile, 6x1 on desktop)
     - Alert banner section (conditionally rendered)
     - Enhanced Production Pulse with tonnage
     - Enhanced Financial Health with overdue count
     - New donut chart for production target
     - Expanded operations strip
     - Enhanced recent orders table

### No Database Changes Required
All new metrics are derived from existing tables already queried. The health score is a client-side calculation.

### Performance
- Same parallel fetch pattern (Promise.all)
- 30-second auto-refresh maintained
- No additional API calls -- reuse existing query data for new calculations
