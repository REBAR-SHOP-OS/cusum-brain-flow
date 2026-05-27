## Goal

The "Unanswered Email — 2h breach" message in the screenshot is sent by the `comms-alerts` edge function (cron-driven). Today the only way to stop it is the `COMMS_ALERTS_DISABLED` env var, which requires a redeploy. You want:

1. A **Stop/Resume toggle** in the admin area that takes effect immediately.
2. A **log of every alert email** that has been sent, visible in the admin area.

## What I'll build

### 1. Runtime kill-switch (no redeploy)

- Add a row to the existing `feature_flags` table: `flag_key = 'comms_alerts_enabled'` (default `true`).
- Update `supabase/functions/comms-alerts/index.ts`: in addition to the existing `COMMS_ALERTS_DISABLED` env check, also read this flag from the DB at the start of each run. If disabled → log `skipped: kill_switch` and return (no emails sent, no DB writes).
- Same gate added to `supabase/functions/check-sla-breaches/index.ts` and `supabase/functions/timeclock-alerts/index.ts` so a single switch silences all internal alert emails.

### 2. Admin page: Alerts Control Center

New route `/admin/alerts` (super-admin only — gated by `useSuperAdmin`, same pattern as `AdminDbAudit`).

Sections:

- **Kill-switch card** — large toggle "Comms alerts enabled / paused". Writes to `feature_flags.enabled` and invalidates the client flag cache. Shows last-changed timestamp + who changed it.
- **Recent dispatches table** — reads from the existing `comms_alerts` table (already logs every alert with `alert_type`, `communication_id`, `owner_email`, `ceo_email`, `owner_notified_at`, `ceo_notified_at`, `resolved_at`, `created_at`). Columns: Time · Type · Recipient · Communication subject (joined) · Status (resolved / unresolved). Filters: last 24h / 7d / 30d, type, recipient. Default 7d.
- **Per-type counters** for the selected range: unanswered-email breaches, missed-call alerts, SLA breaches, timeclock alerts.

### 3. Nav

Add an "Alerts" link inside the existing admin nav (alongside DB Audit / Cron Health), super-admin only.

## Technical notes

- DB: one migration — `INSERT INTO feature_flags(flag_key, enabled, description) VALUES ('comms_alerts_enabled', true, 'Master kill-switch for internal alert emails (comms-alerts, SLA breaches, timeclock).') ON CONFLICT DO NOTHING;` plus `GRANT SELECT, UPDATE ON public.feature_flags TO authenticated;` (UPDATE protected by an RLS policy restricted to super-admin emails via `has_role` / email allowlist).
- Edge function flag check uses `serviceClient` (already in `ctx`) so it bypasses RLS for the read.
- No new tables needed — `comms_alerts` already has everything for the log view.
- Pure additive: existing `COMMS_ALERTS_DISABLED` env var still works as a hard override.

## Out of scope

- Per-recipient mute lists (can be a follow-up).
- Rewriting the alert HTML / changing thresholds.
- Outbound customer emails — only internal alert emails are gated.

Confirm and I'll switch to build mode and ship it.
