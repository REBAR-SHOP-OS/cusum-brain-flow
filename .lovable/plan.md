

## Build CEO Portal as a Standalone Page

### Current State
- `CEODashboardView` lives inside the Admin Panel tab
- The Home "CEO Portal" card routes to `/office` with `state: { section: "ceo-dashboard" }`, but OfficePortal redirects it to `ai-extract`
- Daily Digest exists at `/daily-summarizer` but is not integrated into the CEO view
- No standalone `/ceo` route exists

### What We Will Build

A dedicated `/ceo` route that serves as the **CEO Portal** -- a single-page executive command center combining the existing CEO Dashboard with an **Intelligent Daily Assignments** panel.

#### New Components

**1. `src/pages/CEOPortal.tsx`** -- Standalone page (no Office sidebar)
- Full-width layout with the existing `CEODashboardView` content
- New "Daily Assignments" section at the top, below the Health Score
- Embedded Daily Digest summary (pulls from `daily-summary` edge function)

**2. `src/components/ceo/DailyAssignments.tsx`** -- New intelligent assignments panel
- Fetches today's exceptions, overdue tasks, expiring quotes, pending approvals
- Groups into priority tiers: "Do Now", "Review Today", "Watch This Week"
- Each item shows: title, owner, age, one-tap actions (Approve / Delegate / Snooze)
- Data sources: `mockExceptions` (existing) + live queries for overdue invoices, at-risk jobs, pending meeting actions

**3. `src/components/ceo/DailyBriefingCard.tsx`** -- Compact daily digest embed
- Calls the `daily-summary` edge function for today's date
- Shows: greeting, key takeaways (top 3), and quick stats strip
- "View Full Briefing" link to `/daily-summarizer`

#### Routing Changes

| Change | Detail |
|--------|--------|
| New route `/ceo` | Renders `CEOPortal.tsx` inside `AppLayout` |
| Home "CEO Portal" card | Update route from `/office` to `/ceo` (remove state prop) |
| Admin Panel | Keep CEO Dashboard tab as-is (secondary access) |
| Office Portal | No changes (ceo-dashboard redirect stays) |

#### Layout of CEO Portal Page

```text
+--------------------------------------------------+
| Header: "Good morning, CEO"   [Refresh] [Live]   |
+--------------------------------------------------+
| Health Score Hero (existing)                      |
+--------------------------------------------------+
| Daily Briefing Card (compact digest)              |
| - Greeting + 3 key takeaways + stats strip        |
| - [View Full Briefing ->]                         |
+--------------------------------------------------+
| Intelligent Daily Assignments                     |
| [Do Now] [Review Today] [Watch This Week]         |
| - Exception cards with one-tap actions            |
+--------------------------------------------------+
| KPI Grid (6 cards - existing)                     |
+--------------------------------------------------+
| Production Pulse | Financial Health (existing)    |
+--------------------------------------------------+
| Charts Row (existing)                             |
+--------------------------------------------------+
| Operations Strip (existing)                       |
+--------------------------------------------------+
| Exceptions Workbench (existing)                   |
+--------------------------------------------------+
| Meeting Intelligence (existing)                   |
+--------------------------------------------------+
```

### Technical Details

**Data for Daily Assignments:**
- Overdue invoices: query `accounting_mirror` where `balance > 0`
- At-risk jobs: use existing `mockAtRiskJobs` data
- Pending meeting actions: query `meeting_action_items` where `status = 'draft'`
- Expiring quotes: query `leads` where quote is near expiry
- Machine issues: from `machines` where `status = 'down'`

**Priority classification:**
- "Do Now": severity=critical OR age > 30 days OR machine down
- "Review Today": severity=warning OR items expiring within 48h
- "Watch This Week": severity=info OR upcoming capacity conflicts

**Files to create:**
1. `src/pages/CEOPortal.tsx`
2. `src/components/ceo/DailyAssignments.tsx`
3. `src/components/ceo/DailyBriefingCard.tsx`

**Files to edit:**
1. `src/App.tsx` -- add `/ceo` route
2. `src/pages/Home.tsx` -- update CEO Portal card route to `/ceo`

**No database changes required.** All data comes from existing tables and the existing `daily-summary` edge function.

