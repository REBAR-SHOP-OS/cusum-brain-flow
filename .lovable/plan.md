# Plan: comms-alerts hardening (A + B + D)

Apply three changes to `supabase/functions/comms-alerts/index.ts` (and shared spam filter). No DB changes, no UI changes.

## A) Kill switch
- Add env check `COMMS_ALERTS_DISABLED` at the very top of the handler.
- If `1|true|yes|on` → log `[comms-alerts] skipped: disabled` and return `{ ok: true, skipped: true }`.
- Independent from `EMAILS_DISABLED` so we can re-enable later without touching all email paths.

## B) Harder spam filter
- Extend `supabase/functions/_shared/spamFilter.ts` with an email-oriented keyword/sender list:
  - Subjects: `birthday sale`, `summer course`, `reminder:`, `delivery status notification`, `mail delivery`, `undeliverable`, `instagram`, `kylie jenner`, `newsletter`, `digest`, `unsubscribe`, `% off`, `flash sale`, `weekly recap`.
  - Senders: `mailer-daemon@`, `postmaster@`, `no-reply@instagram`, `notification@`, `news@`, `marketing@`, `noreply@mail.instagram.com`.
- New helper `analyzeEmailSpam({ subject, from, snippet })` reusing normalizer.
- In `comms-alerts`, before queuing any alert, run `analyzeEmailSpam` on the comm; if spam → skip + log reason; do not send to owner or CEO.

## D) Owner-only routing (no CEO fallback for owned comms)
- Current behavior: if owner present, alert goes to owner AND CEO; if no owner, only CEO.
- New behavior:
  - If `owner_email` present and valid (rebar.shop) → send to owner ONLY. No CEO copy.
  - If no owner → keep current single CEO alert (so nothing is silently dropped).
- Keep existing dedupe logic intact.

## Out of scope
- C (suppression of 2h/4h/24h repetition) — not selected.
- Any UI, DB schema, or other edge function changes.

## Files touched
- `supabase/functions/_shared/spamFilter.ts` — add `analyzeEmailSpam` + email keyword list.
- `supabase/functions/comms-alerts/index.ts` — kill switch + spam gate + owner-only routing.

## Verification
- Deploy `comms-alerts`.
- Tail `comms_alerts` table for 1 hour: confirm zero rows for Instagram/Birthday/Delivery Failure subjects; confirm owned comms have no CEO copy.
- Flip `COMMS_ALERTS_DISABLED=true` as emergency stop if needed.
