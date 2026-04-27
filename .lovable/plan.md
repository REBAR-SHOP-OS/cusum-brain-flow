# Stop All Outgoing Emails

You're getting alert emails like the "[Alert] Unanswered email - 24h" one in your screenshot. We'll shut down email sending across the board.

## What will be disabled

1. **Lovable Emails (auth + transactional)** — turn off the project-level email switch so password resets, verification emails, and any app-triggered transactional emails stop going out. Auth emails revert to default Lovable templates but we'll also block sends at the function level.

2. **Custom alert / notification emails** — the ERP sends its own emails via edge functions (e.g. unanswered-email watchdog, daily digests, CEO alerts, branded ERP emails through Gmail/SMTP). We'll add a global kill-switch that short-circuits every email-sending edge function before it dispatches.

3. **Gmail/SMTP outbound** — any function that pushes mail through the connected Gmail account (replies, alerts, reports) will check the kill-switch and skip sending.

## How

- Add a single feature flag `EMAILS_DISABLED` (env var + DB flag in `workspace_settings`) that all email-sending edge functions check at the top and exit early with a logged "skipped: emails_disabled" entry.
- Patch the relevant edge functions to honor the flag:
  - `unanswered-email-watchdog` (the one sending your screenshot alert)
  - `daily-digest` / `email-campaign-*` / `social-publish` email paths
  - `send-transactional-email`, `auth-email-hook`, `process-email-queue`
  - Any Gmail-send wrapper in `_shared` used by ERP replies
- Toggle off Lovable Emails via `email_domain--toggle_project_emails` (enabled: false).
- Leave all UI, queues, and logging intact so nothing breaks — emails just don't go out. Re-enabling later is one flag flip.

## Result

No emails of any kind will leave the system — no alerts, no auth, no transactional, no ERP replies — until you explicitly turn it back on.
