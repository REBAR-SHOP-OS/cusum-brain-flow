
# Odoo → Pipeline Sync Diagnosis & Fix Plan

## Root Cause: No Scheduled Sync

The single most critical finding: **`cron.job` has 0 rows** — there are no scheduled jobs running in the database. The `odoo-crm-sync` and `odoo-chatter-sync` edge functions exist and work correctly (the leads table shows 2,927 Odoo leads last synced on 2026-02-20), but they are only triggered **manually** by an admin clicking the "Sync Odoo" button on the Pipeline page. There is no automatic polling.

**Evidence:**
- `SELECT count(*) FROM cron.job` → `0`
- `odoo-crm-sync` edge function logs: empty (no recent automated calls)
- Last leads `updated_at` timestamps cluster together, confirming a one-time manual bulk sync, not ongoing polling
- The `leads` table is NOT in `supabase_realtime` publication — Odoo-side changes (made directly in Odoo) have no pathway to trigger a Supabase realtime event

---

## Full Diagnosis: All Problems Found

### Problem 1 — CRITICAL: No Scheduled Sync Job
The `odoo-crm-sync` function runs in **incremental mode** (fetches only records changed in the last 5 days) and in **full mode** (all ~2,800 records). Neither runs automatically. Changes made in Odoo — stage moves, new leads, updated values — only appear in the ERP after a human manually clicks "Sync Odoo."

### Problem 2 — HIGH: No Realtime for Odoo-Sourced Changes
The `usePipelineRealtime` hook subscribes to Supabase's `postgres_changes` on the `leads` table. This correctly picks up changes made **within** the ERP (e.g., drag-and-drop stage changes). However, when the `odoo-crm-sync` edge function runs with `SUPABASE_SERVICE_ROLE_KEY`, it updates rows server-side — these updates DO trigger `postgres_changes` events, so realtime is technically wired up. The gap is purely that the sync function never runs automatically.

### Problem 3 — MEDIUM: Chatter/Activity Sync is Also Manual
The `odoo-chatter-sync` function (which syncs notes, emails, and scheduled activities from Odoo's `mail.message` and `mail.activity`) is never called after the initial historical import. New chatter posted in Odoo after the initial sync is invisible in the ERP Lead Timeline.

### Problem 4 — MEDIUM: SLA Breach Checker Also Not Scheduled
The `check-sla-breaches` edge function exists but also has no cron entry. SLA deadlines set by Odoo (`date_deadline` field) will never auto-escalate.

### Problem 5 — LOW: No Sync Status Indicator on Pipeline Page
Users have no way to know when the last sync ran or if it failed. The "Sync Odoo" button gives feedback only on manual click. If the scheduled sync silently fails, no one is alerted.

---

## What is NOT Broken

- The `odoo-crm-sync` edge function logic itself is correct — pagination, deduplication, stage mapping, and validation all work
- The `usePipelineRealtime` hook is correctly subscribed to `postgres_changes`
- The manual sync button on Pipeline page works
- The `odoo-chatter-sync` "missing" mode (backfills leads with zero activities) works

---

## Fix Plan

### Fix 1 — Install pg_cron scheduled jobs (Core Fix)

Create a database migration that registers two cron jobs using `pg_cron` (already available in Supabase):

```text
Job 1: odoo-crm-sync (incremental)
  Schedule: every 15 minutes
  Command: calls the odoo-crm-sync edge function via net.http_post

Job 2: odoo-chatter-sync (missing mode)
  Schedule: every 60 minutes
  Command: calls the odoo-chatter-sync edge function

Job 3: check-sla-breaches
  Schedule: every 30 minutes
  Command: calls the check-sla-breaches edge function
```

The SQL uses `net.http_post` (pg_net extension, already enabled in Supabase) to call the edge functions with the service role key as the Authorization header.

### Fix 2 — Add "Last Synced" indicator to Pipeline header

Add a small status badge near the "Sync Odoo" button that shows:
- When the last successful sync ran (read from the most recent `updated_at` of any `odoo_sync` lead)
- A color indicator: green (< 30 min ago), amber (30–60 min), red (> 60 min)
- Auto-refreshes every 5 minutes

### Fix 3 — Run a full sync on manual button click, incremental on schedule

The current manual button already uses `mode: "full"`. The cron job will use `mode: "incremental"` (last 5 days) to be efficient. This is the correct architecture.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_odoo_cron_sync.sql` | New migration: register 3 pg_cron jobs using `cron.schedule()` |
| `src/pages/Pipeline.tsx` | Add "Last Synced" status badge near sync button |

---

## Technical Details: The pg_cron SQL

```sql
-- Install pg_cron extension if not present
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Incremental Odoo CRM sync every 15 minutes
SELECT cron.schedule(
  'odoo-crm-sync-incremental',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/odoo-crm-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{"mode":"incremental"}'::jsonb
  );
  $$
);

-- Chatter sync every 60 minutes
SELECT cron.schedule(
  'odoo-chatter-sync-hourly',
  '0 * * * *',
  ...
);
```

The service role key will be stored as a Postgres setting (`app.service_role_key`) set via migration, so it is never exposed in client code.

---

## Rollback Plan

If the cron jobs cause performance issues (e.g., Odoo API rate limits hit), they can be disabled immediately with:
```sql
SELECT cron.unschedule('odoo-crm-sync-incremental');
```
No data is at risk — the cron jobs only call the existing, already-tested sync functions.

---

## Expected Outcome After Fix

| Metric | Before | After |
|--------|--------|-------|
| Sync lag | Manual only (hours/days) | Max 15 minutes |
| Chatter sync | Manual only | Hourly |
| SLA escalation | Never runs | Every 30 min |
| Pipeline freshness | Stale | Live within 15 min |
