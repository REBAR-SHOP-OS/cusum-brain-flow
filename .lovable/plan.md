

# Change Office Auto Clock-Out from 5 PM to 6 PM ET

## Changes

### 1. `supabase/functions/auto-clockout/index.ts`
Update all "5 PM" references in comments and notes to "6 PM":
- Line 95: comment `close ONLY office worker shifts at 5 PM ET` → `6 PM ET`
- Line 148: notes field `[auto-closed: 5 PM auto clock-out]` → `[auto-closed: 6 PM auto clock-out]`
- Line 160: log message update

### 2. Database Migration — Update Cron Schedule
The evening auto-clockout cron job currently runs at 5 PM ET (21:00 UTC). Update it to 6 PM ET (22:00 UTC):

```sql
SELECT cron.unschedule('auto-clockout-evening');
SELECT cron.schedule(
  'auto-clockout-evening',
  '0 22 * * 1-5',  -- 6 PM ET = 22:00 UTC, Mon-Fri
  $$SELECT extensions.http_post(...)$$
);
```

Note: The exact cron job body will be verified from existing database state before creating the migration.

### Files Changed
- `supabase/functions/auto-clockout/index.ts` (3 comment/string updates)
- New database migration (reschedule cron job)

