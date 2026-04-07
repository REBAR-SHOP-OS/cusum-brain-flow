
Goal: stop CEO-facing spam SMS alerts at the source and make inbound SMS spam handling consistent across webhook, cron sync, and auto-reply paths.

What I verified
- The exact text shown in your screenshot — `📱 New SMS from +16478983690: ...` — is only sent by `supabase/functions/ringcentral-sync/index.ts`.
- The current spam filter exists, but it is weak and only enforced at the call site.
- `isSpamSms()` in `supabase/functions/_shared/spamFilter.ts` only does simple lowercase + substring checks. That is brittle against spacing, punctuation, Unicode/confusable characters, and message variations.
- `sendCeoSmsAlert()` has no spam-awareness, so if any caller misses detection, the CEO still receives the SMS.
- In both `ringcentral-webhook` and `ringcentral-sync`, spam is currently persisted/logged before filtering, which means noise can still enter internal records even when reply logic is skipped.

Root cause
- Spam suppression is not centralized.
- Detection is too primitive.
- The final outbound CEO alert path has no last-line protection.

Implementation plan
1. Harden the shared spam analyzer
- Replace the simple boolean-only logic in `supabase/functions/_shared/spamFilter.ts` with a normalized analyzer:
  - lowercase
  - trim/collapse whitespace
  - strip punctuation/invisible chars
  - normalize Unicode/confusable characters as much as practical
  - keep keyword/prefix/short-code checks
  - return structured output like `{ isSpam, reasons, normalizedText }`
- Keep a compatibility wrapper if needed so existing callers do not break.

2. Add a dedicated safe helper for inbound SMS CEO alerts
- In `supabase/functions/_shared/smsAlertHelper.ts`, add a helper like:
  - `sendCeoInboundSmsAlert(fromNumber, text)`
- This helper will call the spam analyzer internally and refuse to send if spam is detected.
- Keep `sendCeoSmsAlert()` unchanged for legitimate watchdog / operational alerts.

3. Fix the cron sync path that is actually sending these alerts
- Update `supabase/functions/ringcentral-sync/index.ts` to use the new inbound-SMS-safe helper instead of directly formatting and sending the alert.
- Compute spam once per message and reuse that result for:
  - CEO alert suppression
  - auto-reply suppression
  - cleaner logging
- Add spam reason metadata to the stored communication row when detected.

4. Make webhook behavior match cron behavior
- Update `supabase/functions/ringcentral-webhook/index.ts` to use the same shared spam analysis result before downstream actions.
- Skip `vizzy-sms-reply` for spam using the same structured analyzer.
- Avoid creating noisy `sms_received` activity entries for obvious spam, or at minimum mark them clearly as spam in metadata.

5. Keep AI reply logic aligned
- Update `supabase/functions/vizzy-sms-reply/index.ts` to use the same structured spam analyzer so all inbound SMS decisions come from one source of truth.

Validation
- Confirm the exact screenshot examples are classified as spam:
  - “Join me on WhatsApp…”
  - “Let’s chat on WhatsApp…”
  - “Shares + acquisition reveal”
- Confirm spam messages do not:
  - send CEO SMS alerts
  - trigger auto-replies
  - create normal `sms_received` operational noise
- Confirm legitimate customer SMS still:
  - get stored
  - can trigger reply flow
  - can notify when appropriate

Files to change
- `supabase/functions/_shared/spamFilter.ts`
- `supabase/functions/_shared/smsAlertHelper.ts`
- `supabase/functions/ringcentral-sync/index.ts`
- `supabase/functions/ringcentral-webhook/index.ts`
- `supabase/functions/vizzy-sms-reply/index.ts`

Technical notes
- No database migration is required.
- This is a minimal, root-level fix: centralize the decision once, enforce it everywhere, and put a final guard on the CEO SMS alert path so this class of bug cannot leak through again.
