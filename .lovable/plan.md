## Goal

Stop **all automated/system-triggered emails** (alerts, reports, watchdogs, auto-replies, campaigns) — not user-composed Gmail replies typed in the UI. Last round wired the kill-switch into 6 senders but never **flipped the switch on**, and a few automated senders are still unguarded.

## What's already protected
`gmail-send`, `comms-alerts` (unanswered-email watchdog — the one that sent your screenshot), `email-activity-report`, `timeclock-alerts`, `send-quote-email`, `notify-lead-assignees`.

## What's still missing

1. **Automated senders not yet guarded** — will keep sending even after we flip the flag:
   - `daily-summary` — daily digest email
   - `process-rfq-emails` — auto-reply / RFQ acknowledgments
   - `email-campaign-send` — bulk campaigns
   - `alert-router` — alert dispatcher (if it sends mail)
   - `admin-chat`, `support-chat`, `vizzy-erp-action` — only the **automated** email-send paths inside them (not the chat itself)

2. **The flag isn't actually on.** `EMAILS_DISABLED` env var was never set, so every guarded function still sends. This is why you're still getting alerts.

3. **Lovable Emails (auth + transactional)** — still enabled at the project level.

## Plan

1. Add `isEmailSendingDisabled()` short-circuit to the 6 remaining automated senders above. Guard only the **automated** send paths in chat/ERP functions — leave user-typed Gmail replies alone (those go through `gmail-send`, which is already guarded; flipping the flag would also block manual replies, see note below).
2. Set `EMAILS_DISABLED=true` as a Supabase secret so every guarded function exits early.
3. Disable Lovable Emails via `email_domain--toggle_project_emails` (auth emails revert to default templates, transactional sends stop).
4. Redeploy all touched edge functions.
5. Verify: tail logs of `comms-alerts` and `gmail-send` for `[email-kill-switch] Skipped` entries.

## Important note — scope

`gmail-send` is the chokepoint for **both** automated emails *and* user-composed replies from the inbox UI. Flipping `EMAILS_DISABLED=true` will block **both**. If you want users to still be able to manually reply to emails from the UI while only automated alerts/reports/digests are stopped, say so and I'll narrow the guard so `gmail-send` only blocks when called from automation (e.g. by checking a `source: "automation"` flag passed by the caller) and leaves direct user-triggered sends working.

## Result

Zero automated emails leave the system. Re-enable later by unsetting `EMAILS_DISABLED` and re-toggling Lovable Emails.