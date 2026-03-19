
Audit result: the “0” is coming from two different problems, not one.

1. What is actually true right now
- Gmail is not zero in the database.
- I checked live data and found 28 Gmail emails today for your company/user, all inbound.
- RingCentral really is 0 calls today in the database, and the latest RingCentral communication is from 2026-03-18 16:28 UTC, so phone sync is stale by about a day.
- So Vizzy saying “0 emails” is wrong, but “0 calls today” is only partially true and should have been framed as stale-sync, not normal zero.

2. Root causes found

A. Vizzy email context is reading the wrong schema
File: `supabase/functions/_shared/vizzyFullContext.ts`
- It selects `gmail_thread_id` from `communications`, but the actual column is `thread_id`.
- The same wrong column is also used in `supabase/functions/admin-chat/index.ts`.
- Since `buildFullVizzyContext()` is the context source for Vizzy chat, this bad select is the strongest reason Vizzy can end up with broken/empty email stats and say “0 inbound / 0 outbound”.

B. RingCentral sync is stale
- Database shows no RingCentral call records today.
- Latest RingCentral communication is yesterday.
- `integration_connections` has a Gmail row for your user, but no RingCentral row at all, even though a RingCentral token exists.
- That means the phone integration state is not being surfaced reliably, so the UI/assistant can miss that the connection is stale or partially disconnected.

C. Sync error logging is failing repeatedly
Files: `supabase/functions/gmail-sync/index.ts`, `supabase/functions/ringcentral-sync/index.ts`
- Both sync functions upsert into `activity_events` with `onConflict: "dedupe_key"`.
- Logs show `42P10: no unique or exclusion constraint matching the ON CONFLICT specification`.
- This does not appear to stop `communications` inserts, but it creates noisy failures and may hide real sync issues.

D. Vizzy prompt behavior still allows bad fallback framing
- The voice/chat prompt says not to act like “no calls” is normal when sync is stale.
- But because email context is broken and RingCentral status is incomplete, the model still falls back to “go to Integrations” instead of giving a correct live summary.

3. Recommended fix plan

Step 1 — Fix Vizzy context queries
- Replace every `gmail_thread_id` reference with `thread_id`.
- Update both:
  - `supabase/functions/_shared/vizzyFullContext.ts`
  - `supabase/functions/admin-chat/index.ts`
- Make sure the email summary logic reads the real thread field so inbound/outbound counts and unanswered-thread logic work again.

Step 2 — Harden context loading against partial query failure
- In `buildFullVizzyContext()`, stop assuming every query succeeds.
- Check query errors explicitly and degrade gracefully per section instead of silently producing empty totals.
- If email query fails, include a clear “email data unavailable” line in context rather than zeroes.

Step 3 — Surface RingCentral stale state correctly
- Ensure RingCentral writes/updates `integration_connections` the same way Gmail does.
- If token exists but sync is stale or refresh fails, mark the integration row so Vizzy and the Integrations page both see the same truth.
- This will turn the current hidden stale state into a visible reconnect/warning state.

Step 4 — Fix activity ledger dedupe
- Add the required unique constraint/index for `activity_events.dedupe_key`, or stop using `onConflict: "dedupe_key"` if uniqueness is not intended.
- This removes the repeated 42P10 errors and makes sync logs trustworthy again.

Step 5 — Improve Vizzy’s response logic for “check emails/calls”
- If today’s RingCentral count is 0 but last call is recent-ish and sync is stale, Vizzy should say:
  - phone data appears stale,
  - last seen timestamp,
  - recent call notes if available,
  - and only then recommend reconnecting.
- For email, if live context has records, Vizzy should summarize them directly instead of saying zero.

4. Expected outcome after fix
- “Check emails” will stop incorrectly reporting 0 when emails exist.
- “Check calls” will report stale-sync accurately instead of pretending the day is empty.
- Integrations status and Vizzy status will align.
- Sync logs will become actionable instead of flooded with false conflict errors.

5. Files to update
- `supabase/functions/_shared/vizzyFullContext.ts`
- `supabase/functions/admin-chat/index.ts`
- `supabase/functions/gmail-sync/index.ts`
- `supabase/functions/ringcentral-sync/index.ts`
- one new migration for the `activity_events.dedupe_key` uniqueness fix

6. Key evidence from the audit
- Gmail today in DB: 28 inbound, 0 outbound
- RingCentral today in DB: 0 calls
- Latest Gmail message: 2026-03-19 18:32 UTC
- Latest RingCentral communication: 2026-03-18 16:28 UTC
- Gmail integration row exists and is connected
- RingCentral integration row is missing
- Gmail sync logs repeatedly show `42P10` on `activity_events` conflict handling
