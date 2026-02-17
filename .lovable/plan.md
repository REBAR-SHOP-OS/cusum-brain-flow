
# Fix: Ben's Chatter Visibility + Global Notification Pop-up

## Issue 1: Ben Cannot See Chatter in Pipelines

### Root Cause
The `lead_activities` table has a SELECT RLS policy that uses a correlated subquery through the `leads` table:

```sql
company_id IN (SELECT l.company_id FROM leads l WHERE l.id = lead_activities.lead_id)
```

This subquery is subject to `leads` table RLS, which requires `has_any_role(auth.uid(), ARRAY['admin', 'sales', 'accounting'])`. While Ben has the `sales` role, this nested RLS evaluation can fail in edge cases (PostgreSQL's RLS-within-RLS evaluation is known to have subtle issues with correlated subqueries). The INSERT, UPDATE, and DELETE policies on the same table use the simpler `company_id = get_user_company_id(auth.uid())` pattern, which works reliably.

### Fix
Replace the SELECT policy with the same simple pattern used by the other policies:

```sql
DROP POLICY "Users can view activities for their company leads" ON lead_activities;
CREATE POLICY "Users can view activities for their company"
  ON lead_activities FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));
```

This is consistent with all other policies on the table and eliminates the subquery dependency.

---

## Issue 2: Global In-App Notification Pop-up

### Current State
When a notification arrives via realtime:
- Sound plays (mockingjay whistle)
- Browser notification shows (only when tab is not focused)
- Badge count updates on the bell icon
- But there is NO visible in-app pop-up/toast

### Fix
Add a `sonner` toast pop-up inside the `useNotifications` realtime handler. When a new notification INSERT event arrives, display a clickable toast with the notification title and description. Clicking it navigates to the `link_to` URL.

**File: `src/hooks/useNotifications.ts`**

In the realtime INSERT handler (around line 196), after `showBrowserNotification`, add:

```typescript
toast(newRow.title, {
  description: newRow.description || undefined,
  duration: 8000,
  action: newRow.link_to ? {
    label: "View",
    onClick: () => { window.location.href = newRow.link_to; }
  } : undefined,
});
```

This uses the already-imported `sonner` toast, which renders on any page since the `<Toaster />` component is mounted at the app root.

---

## Summary

| Change | File | What |
|--------|------|------|
| Fix RLS policy | Database migration | Replace subquery-based SELECT policy on `lead_activities` with simple `company_id = get_user_company_id()` |
| Add in-app popup | `src/hooks/useNotifications.ts` | Show a sonner toast with title, description, and "View" action on every new notification |
