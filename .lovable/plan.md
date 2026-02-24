

## Fix Call Analytics + Add Email Analytics Page

### Problem 1: Call Analytics Shows 0

**Root Cause**: The database has **446 calls** in the last 30 days, but the dashboard shows 0. The `useCallAnalytics` hook queries the `communications` table directly from the frontend, where RLS restricts results to `user_id = auth.uid()` (only admin users see all company calls). If the logged-in user isn't an admin or doesn't have call records under their user_id, they see nothing.

**Fix**: Create a backend function `ringcentral-call-analytics` that queries with the service role key (bypassing per-user RLS) and returns aggregated analytics for the entire company. The frontend hook will call this function instead of querying the table directly.

### Problem 2: Email Analytics Page Missing

**Solution**: Build an `EmailAnalyticsDashboard` component (similar structure to `CallAnalyticsDashboard`) and a corresponding `useEmailAnalytics` hook, showing:
- Total emails received (last 30 days)
- Daily volume chart
- Top senders
- AI category distribution (once AI categorization populates)
- Response rate metrics

---

### Technical Details

#### Files to Create

1. **`supabase/functions/ringcentral-call-analytics/index.ts`**
   - Accepts authenticated requests, verifies user belongs to a company
   - Queries `communications` table with service role (all company calls, type=call, last N days)
   - Returns pre-aggregated analytics: daily volume, totals, outcomes, top contacts, avg duration

2. **`src/hooks/useEmailAnalytics.ts`**
   - Similar pattern to `useCallAnalytics` but for `source = 'gmail'`
   - Also uses a backend function for company-wide data
   - Computes: daily email volume, top senders, category distribution

3. **`supabase/functions/email-analytics/index.ts`**
   - Backend function for email analytics (same pattern as call analytics)
   - Aggregates gmail communications for the company

4. **`src/components/inbox/EmailAnalyticsDashboard.tsx`**
   - Dialog-based dashboard (same pattern as `CallAnalyticsDashboard`)
   - KPI cards: Total Emails, Inbound, Action Required %, Avg Response Time
   - Daily volume bar chart
   - Top senders list
   - Category pie chart

#### Files to Modify

5. **`src/hooks/useCallAnalytics.ts`**
   - Replace direct Supabase query with `supabase.functions.invoke("ringcentral-call-analytics")`
   - Keep the same `CallAnalyticsData` interface

6. **`src/components/inbox/InboxView.tsx`**
   - Add "Email Analytics" button next to "Analytics" button in the toolbar
   - Import and render `EmailAnalyticsDashboard` dialog

### What Stays the Same
- `CallAnalyticsDashboard.tsx` UI component (unchanged -- only the data source changes via the hook)
- Database schema (no migrations needed)
- RLS policies (unchanged)
- All other components

