

## Make All Company Emails Visible to All Users

Currently, the `communications` table has an RLS policy that restricts each user to only see their own synced emails (`user_id = auth.uid()`). You want every team member to see **all** emails across the company.

### What will change

1. **Database policy update** -- Replace the current SELECT policy `"Users read own communications in company"` with a new one that allows any authenticated user in the same company to read all communications for that company. The filter changes from `user_id = auth.uid()` to just `company_id = get_user_company_id(auth.uid())`.

2. **No frontend code changes needed** -- The `useCommunications` hook already queries all rows from `communications` without a `user_id` filter. Once the RLS policy is relaxed, all company emails will automatically appear.

### Technical Details

**SQL migration to run:**

```sql
-- Drop the restrictive per-user SELECT policy
DROP POLICY "Users read own communications in company" ON public.communications;

-- Create a company-wide SELECT policy
CREATE POLICY "Users read all communications in company"
  ON public.communications
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));
```

This keeps data isolated between companies but allows all users within the same company to see every email, call, and SMS synced by any team member.

**UPDATE policy** will remain user-scoped (only the owner can mark their emails read/unread, archive, etc.). INSERT and DELETE policies also remain unchanged.

