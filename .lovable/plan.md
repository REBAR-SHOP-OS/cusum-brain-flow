

# Fix: Smart Alert Filtering for Comms Engine

## Problem
The `comms-alerts` function is flooding inboxes because it has zero intelligence about what deserves an alert:

1. **Spam/marketing emails trigger alerts** -- newsletters, promotions, system notifications (QuickBooks, Synology, flight deals, OpenAI, etc.)
2. **Internal emails trigger alerts** -- `@rebar.shop` team messages, task updates, daily reports
3. **Triple-firing** -- each email triggers alerts at 2h, 4h, AND 24h thresholds independently, sending 3 separate alert emails for the same message
4. **Alerts sent TO ai@rebar.shop** -- the bot is alerting itself about its own daily reports

---

## Solution

Update `supabase/functions/comms-alerts/index.ts` with three layers of filtering:

### Layer 1: Skip List (instant, no AI needed)
Add the same `SKIP_SENDERS` list already used in `process-rfq-emails` to immediately discard alerts for known marketing/system senders:
- `noreply@`, `no-reply@`, `mailer-daemon@`
- `@accounts.google.com`, `@stripe.com`, `@linkedin.com`, `@facebookmail.com`
- `@newsletter.`, `@marketing.`, `@notify.`
- `@synologynotification.com`, `@ringcentral.com`, etc.

### Layer 2: Internal Email Filter
Skip any email where `from_address` contains `@rebar.shop` (the configured `internal_domain`). Internal team communications should never trigger unanswered-email alerts.

### Layer 3: Escalation-Only Thresholds (no triple-fire)
Change behavior so only the **highest breached threshold** fires an alert, not all three:
- If an email is 25h old, only the 24h alert fires (not 2h + 4h + 24h)
- This reduces alert volume by ~66%

### Layer 4: Subject-Based Spam Detection
Add keyword patterns to catch remaining junk that slips past the sender filter:
- Subjects containing promotional language: "% off", "deals", "cheap", "unsubscribe"
- System subjects: "[CMS]", "[Task Update]", "Daily Report"

---

## Technical Changes

**File: `supabase/functions/comms-alerts/index.ts`**

1. Add `SKIP_SENDERS` array (copy from `process-rfq-emails`)
2. Add `SKIP_SUBJECTS` patterns array
3. Add `shouldSkipAlert(comm, internalDomain)` function that checks:
   - Sender against skip list
   - Sender domain against internal domain
   - Subject against spam keywords
   - `to_address` is not a bot/system address (e.g., `ai@rebar.shop`)
4. Modify threshold logic: for each email, only fire the **single highest breached** threshold
5. Apply `shouldSkipAlert()` filter before creating any alert

---

## Expected Impact
- Eliminates alerts for newsletters, promotions, system notifications
- Eliminates alerts for internal team emails
- Reduces duplicate alerts from 3-per-email to 1-per-email
- Only genuinely unanswered external business emails will trigger alerts
