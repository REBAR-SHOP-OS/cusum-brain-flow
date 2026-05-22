## Root cause

The `comms-alerts` cron (in `supabase/functions/comms-alerts/index.ts`) sends "⏰ Unanswered Email — Xh breach" notifications. The recipient (`alert.owner`) is taken from `comm.to_address` of inbound messages:

```ts
const ownerEmail = comm.to_address?.toLowerCase() || "";
```

It then sends to that address:

```ts
if (alert.owner) await sendAlertEmail(accessToken, alert.owner, subj, html);
```

But `to_address` is unreliable — for some Gmail-synced threads (replies, forwards, mislabeled inbound) it ends up being the **external customer's email**, not an internal mailbox. Database confirms this is actively happening:

```
owner_email = "lantern developments (pembroke) inc." <lantern.developments@gmail.com>
subject     = RE: SO2324
alert_type  = response_time_24h
```

Two of these were sent today (18:15 and 18:30 UTC), which is exactly what David Langlois complained about. Same bug also sent alerts to `sonia@ontariorebars.ca`, `info@ontariorebars.ca`, `orders@ontariorebars.ca`, `matias@edgegroupltd.com`, etc. The CEO (`sattar@rebar.shop`) also got every one of them as a CC.

## Fix (surgical, in `comms-alerts/index.ts` only)

Add a **hard allow-list gate** before any `sendAlertEmail` call so the alert can only land in an internal mailbox.

1. **Owner sanitization** (around line 341):
   - Parse `comm.to_address` with a name+email regex (current code stores raw `"Name" <addr>` strings).
   - If the extracted address does **not** end with `@${config.internal_domain}` (e.g. `@rebar.shop`), treat owner as missing — do not derive owner from external addresses.
   - Optionally fall back to looking up the matching internal mailbox via `comms_agent_pairing` if needed; otherwise leave owner empty.

2. **Send-time guard** (around line 421 and 431):
   - Before `sendAlertEmail(...)`, assert recipient ends with `@${config.internal_domain}`. If not, skip the send, log `[guard] dropped external alert recipient: <addr>`, and write `metadata.dropped_external = true` on the `comms_alerts` row.
   - Apply the same guard to the CEO send (defense in depth; `ceo_email` is already internal, but guard anyway).

3. **Idempotency carry-over**: the `comms_alerts` row is still inserted so we don't re-alert on the same `(communication_id, alert_type)` next cron tick. We just don't email externals.

4. **Backfill cleanup (one-off SQL, not a migration)**: mark the already-created external-recipient rows as suppressed so they don't muddy reporting:
   ```sql
   UPDATE comms_alerts
   SET metadata = jsonb_set(coalesce(metadata,'{}'::jsonb), '{dropped_external}', 'true')
   WHERE owner_email !~* '@rebar\.shop'
     AND owner_email <> ''
     AND created_at > now() - interval '7 days';
   ```

No other files touched. No schema change. No RLS change. No frontend change.

## Out of scope

- Rewriting how `communications.to_address` is parsed during Gmail sync (separate, larger bug).
- Changing thresholds, skip-sender lists, or CEO recipient logic.
- Touching `missed_call` alert path (already routes through `comms_agent_pairing` and stays internal).

## Verification

1. After deploy, manually invoke `comms-alerts` (or wait one cron tick).
2. Query `comms_alerts` for rows in the last 15 min — every `owner_notified_at IS NOT NULL` row must have `owner_email LIKE '%@rebar.shop'`.
3. Inspect Edge Function logs for `[guard] dropped external alert recipient` entries corresponding to threads like `RE: SO2324`.
4. Confirm `lantern.developments@gmail.com` receives no new alert in the next hour.
