

# Expand Backup to Cover Full ERP Database

## Problem
The backup only backs up **9 tables** (2.3 MB) but the full ERP database has **40+ tables totaling ~100+ MB**. Critical business data is completely excluded from backups.

## Current vs Required Coverage

```text
CURRENTLY BACKED UP (9 tables, ~2.3 MB):
  leads, orders, profiles, contacts, customers,
  projects, project_tasks, order_items, work_orders

MISSING FROM BACKUP (major tables):
  lead_activities       38,472 rows   39 MB   <-- BIGGEST TABLE
  chat_messages            377 rows   19 MB
  qb_transactions        4,132 rows  8.4 MB
  accounting_mirror      1,902 rows  7.1 MB
  lead_files            15,787 rows  6.4 MB
  communications         1,231 rows    5 MB
  qb_customers           1,946 rows  4.5 MB
  quotes                 2,586 rows    2 MB
  activity_events        1,223 rows  1.2 MB
  scheduled_activities   1,929 rows  936 KB
  gl_lines               3,085 rows  944 KB
  gl_transactions        1,591 rows  592 KB
  lead_events              447 rows  512 KB
  notifications            775 rows  504 KB
  seo_keyword_ai         1,130 rows  632 KB
  seo_rank_history       1,232 rows  536 KB
  contacts (already in)  2,679 rows  792 KB
  ... plus 20+ smaller tables
```

## Solution

### File: `supabase/functions/system-backup/index.ts`

Expand `TABLES_TO_BACKUP` from 9 to all ~35 business tables:

```text
leads, orders, profiles, contacts, customers,
projects, project_tasks, order_items, work_orders,
lead_activities, lead_events, lead_files,
scheduled_activities, activity_events,
quotes, quote_items,
communications, comms_alerts,
chat_messages, chat_sessions,
qb_transactions, qb_customers, qb_accounts, qb_vendors, qb_items,
accounting_mirror, gl_transactions, gl_lines,
notifications, user_roles,
machines, machine_capabilities, machine_runs,
cut_plans, cut_plan_items,
tasks, extract_sessions, extract_rows,
support_conversations, support_messages,
team_messages, team_channels, team_channel_members
```

### Important Note on Size
- With all tables included, the backup JSON will be approximately **80-100 MB**
- The `lead_activities` table alone (38K rows) will be the bulk of it
- The 10,000 row limit per table in the current code is sufficient for most tables, but `lead_activities` has 38,472 rows -- we need to increase the limit to 50,000 for that table
- Storage upload limit in Supabase is 50 MB by default for a single file, so we may need to handle this

### Changes
1. Expand `TABLES_TO_BACKUP` array to include all business tables
2. Increase per-table row limit from 10,000 to 50,000 to capture `lead_activities` fully
3. No UI changes needed -- the backup modal already shows file size dynamically

### No changes to:
- Database schema, RLS, or UI components
- Backup/restore logic (same JSON snapshot approach)
- Retention policy (7 days / 50 snapshots)
