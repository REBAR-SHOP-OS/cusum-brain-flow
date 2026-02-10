

## Fix: Ben Can't See Pipeline + Daily Summarizer Mismatch

### Root Cause

Ben (`ben@rebar.shop`) has the **sales** role. The current RLS policy on the `leads` table requires sales users to have `assigned_to = auth.uid()` to see any leads. Out of 1,046 active leads, **zero** are assigned to Ben's user ID -- so he sees an empty pipeline.

The Daily Summarizer uses the service role (bypasses RLS) and shows pipeline data in the digest that Ben then can't access in the actual Pipeline page. This creates a confusing mismatch.

### Changes

**1. Fix Pipeline RLS policy** -- Allow all sales/accounting users in the same company to see ALL leads (not just their own). This matches how the communications policy was already updated to be company-wide.

```sql
DROP POLICY IF EXISTS "Sales team reads own leads" ON public.leads;

CREATE POLICY "Sales team reads leads in company"
ON public.leads FOR SELECT TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
);
```

**2. Fix Pipeline UPDATE policy** -- Similarly allow sales/accounting to update any lead in their company (needed for drag-and-drop stage changes).

```sql
DROP POLICY IF EXISTS "Sales team updates own leads" ON public.leads;

CREATE POLICY "Sales team updates leads in company"
ON public.leads FOR UPDATE TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
);
```

**3. Daily Summarizer -- scope leads to the target date** -- Currently the leads query in the edge function fetches the latest 20 leads regardless of date. It should filter to leads updated on the target date so the digest reflects that day's pipeline activity, not just a random snapshot.

Change the leads query (line ~307) from:
```typescript
// Current: no date filter
.order("updated_at", { ascending: false }).limit(20)
```
To:
```typescript
// Fixed: only leads updated on the target date
.gte("updated_at", dayStart).lte("updated_at", dayEnd)
.order("updated_at", { ascending: false }).limit(30)
```

### What This Fixes

- Ben (and all sales team members) will see **all company leads** in the Pipeline board
- The Daily Summarizer will show only leads that had activity on the selected date, making the digest accurate and actionable
- No more mismatch between what the digest reports and what Ben can see in the UI

### No Frontend Changes Needed

The Pipeline page and Daily Summarizer page code remain unchanged -- only the database policies and the edge function query are updated.
