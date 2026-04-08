

# Fix: Cannot Delete User — Foreign Key Blocking

## Root Cause

The user `swapnil.m183@gmail.com` cannot be deleted because **`sales_lead_activities`** has 3 rows referencing this user's ID, and the foreign key uses the default `ON DELETE RESTRICT` (no cascade, no set null). This means the database blocks deletion of the auth user.

There are also 4 other tables with the same unsafe FK pattern (no delete action specified):
- `backup_restore_logs.performed_by`
- `invite_tokens.created_by`
- `pipeline_automation_rules.created_by`
- `system_backups.created_by`

These don't have data for this user currently, but will cause the same problem for other users in the future.

## Fix — One Migration

Change all 5 foreign keys from `RESTRICT` (default) to `ON DELETE SET NULL`, which matches the project's historical preservation posture (per project memory).

```sql
-- sales_lead_activities
ALTER TABLE sales_lead_activities
  DROP CONSTRAINT sales_lead_activities_user_id_fkey,
  ADD CONSTRAINT sales_lead_activities_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- backup_restore_logs
ALTER TABLE backup_restore_logs
  DROP CONSTRAINT backup_restore_logs_performed_by_fkey,
  ADD CONSTRAINT backup_restore_logs_performed_by_fkey
    FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- invite_tokens
ALTER TABLE invite_tokens
  DROP CONSTRAINT invite_tokens_created_by_fkey,
  ADD CONSTRAINT invite_tokens_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- pipeline_automation_rules
ALTER TABLE pipeline_automation_rules
  DROP CONSTRAINT pipeline_automation_rules_created_by_fkey,
  ADD CONSTRAINT pipeline_automation_rules_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- system_backups
ALTER TABLE system_backups
  DROP CONSTRAINT system_backups_created_by_fkey,
  ADD CONSTRAINT system_backups_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
```

Additionally, fix the 26 RESTRICT foreign keys on `profiles` to use `ON DELETE SET NULL` so that cascading profile deletion (triggered by auth user deletion) doesn't get blocked by referencing tables. Key tables include: `team_messages`, `machine_runs`, `orders`, `tasks`, `task_comments`, `bid_board`, `expense_claims`, `deliveries`, etc.

## Result
After this migration, deleting a user will:
1. Set their references to `NULL` in activity/audit tables (preserving history)
2. Cascade-delete their `profiles` row (existing behavior)
3. Set profile references to `NULL` in all operational tables
4. Complete successfully without foreign key violations

## Files Modified
- Database migration only (no app code changes needed)

