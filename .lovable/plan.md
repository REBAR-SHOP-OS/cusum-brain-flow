

# Create Missing CON-FRAME Invoice #1971 Task for Vicky

## Problem
Vizzy claimed it created the task "Investigate Unpaid CON-FRAME Invoice #1971" for Vicky Anderson, but the database confirms it was **never actually inserted**. Vicky's profile ID is `e82c7ca3-126f-4f88-a368-4774aa8d450e`. The task does not exist.

## Fix
**Direct database insert** — create the task now via a migration or edge function call.

Insert into the `tasks` table:

```sql
INSERT INTO tasks (title, description, assigned_to, priority, due_date, status, company_id, source)
SELECT
  'Investigate Unpaid CON-FRAME Invoice #1971',
  'Please investigate why invoice #1971 for $8,362.00, due Nov 18, 2025, remains unpaid. CON-FRAME LTD is an active customer and has paid many invoices issued after this one. Find the root cause (e.g., dispute, lost invoice, error) and recommend the next action.',
  'e82c7ca3-126f-4f88-a368-4774aa8d450e',
  'high',
  '2026-04-09',
  'open',
  company_id,
  'vizzy'
FROM profiles
WHERE id = 'e82c7ca3-126f-4f88-a368-4774aa8d450e';
```

This uses a subquery to get the correct `company_id` from Vicky's profile.

## Result
- Task will appear immediately in Vicky's column on the Employee Tasks board
- Realtime subscription will highlight it with the green glow animation

