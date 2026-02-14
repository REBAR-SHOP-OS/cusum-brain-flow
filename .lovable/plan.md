

# Attendance Alerts: Notify When Employees Miss Clock-In or Clock-Out

## What This Does

Automatically checks every day whether employees forgot to clock in or forgot to clock out, and:
1. Creates an in-app notification (appears in the Inbox panel)
2. Sends an email alert to the employee and their manager/admin

## How It Works

A new backend function (`timeclock-alerts`) runs on a schedule (e.g., twice daily -- mid-morning and end of day) and checks:

- **Missed clock-in**: Active employees who have no `time_clock_entries` record for today by 9:30 AM
- **Missed clock-out**: Employees who clocked in but never clocked out (still have `clock_out = NULL` after 6:00 PM)

For each violation it:
1. Inserts a row into the `notifications` table (so it shows in the Inbox panel with a link to `/timeclock`)
2. Sends an email to the employee (and optionally admin) using the existing email infrastructure

## Implementation

### 1. New Edge Function: `supabase/functions/timeclock-alerts/index.ts`

- Query `profiles` for all active employees
- Query `time_clock_entries` for today
- Compare to find:
  - Profiles with NO entry today (missed clock-in) -- only checked after 9:30 AM
  - Profiles with an open entry (`clock_out IS NULL`) -- only checked after 6:00 PM
- For each missing employee:
  - Insert a notification record (`type: "notification"`, `agent_name: "Forge"`, `priority: "high"`, `link_to: "/timeclock"`)
  - Send an email via the Gmail/email sending infrastructure already in the project
- Deduplicate: skip if a notification with the same metadata (date + profile_id + alert type) already exists today

### 2. Schedule Configuration

Add a cron schedule in `supabase/config.toml` to run the function twice daily:
- 9:30 AM (check missed clock-ins)
- 6:30 PM (check missed clock-outs)

The function accepts a `check_type` parameter (`missed_clockin` or `missed_clockout`) so the same function handles both scenarios.

### 3. No Database Changes Needed

The existing `notifications` table already supports everything needed -- `type`, `title`, `description`, `agent_name`, `priority`, `link_to`, `metadata`, and `assigned_to` (for targeting the specific employee's `user_id`).

## Technical Details

| Item | Detail |
|------|--------|
| New file | `supabase/functions/timeclock-alerts/index.ts` |
| Config change | `supabase/config.toml` -- add cron schedule |
| Tables used | `profiles`, `time_clock_entries`, `notifications` |
| Agent identity | Forge (workshop agent), color `bg-orange-500` |
| Dedup key | `metadata.date + metadata.profile_id + metadata.alert_type` |
| Email | Uses existing Gmail secrets (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`) |

