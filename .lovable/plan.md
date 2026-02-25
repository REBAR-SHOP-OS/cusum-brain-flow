

## Restrict Financial Data in Daily Briefing for Non-Admin Users

### Problem
The `vizzy-daily-brief` edge function returns sensitive financial data (AR/AP, overdue invoices, bills) to any authenticated user. While the frontend gates the component to super admins, the backend has no role-based filtering — a shop floor user could call the function directly and receive financial data.

### Solution
Add a role check inside the `vizzy-daily-brief` edge function. After authenticating the user, query `user_roles` for their roles. If they lack the `admin` role, strip financial data from the context and adjust the AI prompt to skip the Financials bullet point.

### Changes

**File: `supabase/functions/vizzy-daily-brief/index.ts`**

1. After getting the user, query `user_roles` to check if the user has the `admin` role
2. Pass the role info to `buildFullVizzyContext` (or apply filtering after)
3. If user is NOT admin:
   - Remove the FINANCIALS section from the context string (replace it with a placeholder like "FINANCIALS: Access restricted")
   - Modify the system prompt to replace bullet point #2 (Financial health) with an operational item (e.g., "Inventory or stock status")

**File: `supabase/functions/_shared/vizzyFullContext.ts`**

Add an optional `options` parameter with `{ includeFinancials?: boolean }`:
- When `includeFinancials` is false, skip the accounting_mirror queries entirely (don't even fetch the data)
- Replace the FINANCIALS section in the output with "FINANCIALS: Restricted — requires admin access"

### Technical Details

```text
User calls vizzy-daily-brief
  -> Authenticate user
  -> Query user_roles for admin role
  -> If admin: full context + full prompt (current behavior)
  -> If not admin: context without financials + adjusted prompt
```

In `vizzyFullContext.ts`, the change is to conditionally skip the two `accounting_mirror` queries (lines 86-97) and the financials computation (lines 130-171), replacing the output section (lines 297-303) with a restricted notice.

In `vizzy-daily-brief/index.ts`, the system prompt bullet #2 changes from "Financial health (AR/AP, overdue items)" to "Inventory or stock highlights" for non-admin users.

No database changes required. The `user_roles` table already exists.

