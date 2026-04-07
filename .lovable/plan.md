

# Make Vizzy 24/7 Active: Always-On Monitoring + Danger SMS Alerts

## The Problem

Vizzy's call handling (`VizzyCallHandler`) only works when the CEO's browser is open — it's a React component that runs client-side. If the browser is closed, no calls are answered. The watchdog runs every 15 minutes but only creates in-app notifications — it doesn't SMS the CEO for dangerous situations.

## What Needs to Change

### 1. `supabase/functions/vizzy-business-watchdog/index.ts` — SMS CEO on Dangerous Alerts

The watchdog already runs every 15 min via cron and detects: unanswered emails, stalled leads, at-risk production, missed deliveries, overdue invoices, long shifts, broken integrations. Currently it only writes to `notifications` table.

**Add:** After writing each alert, if priority is "high" or the alert type is dangerous (broken integrations, missed deliveries, overdue invoices >$5k, long shifts >12h), also call `sendCeoSmsAlert()` with a short summary.

~10 lines added.

### 2. `supabase/functions/vizzy-call-receptionist/index.ts` — Add 24/7 Always-On Directive

Update the sales agent prompt to explicitly state Vizzy is available 24/7/365 — not just after hours. The prompt already handles business hours vs after hours messaging. Add a line reinforcing that Vizzy never sleeps, always answers, always takes care of business.

~3 lines added to both prompt modes.

### 3. `supabase/functions/_shared/vizzyIdentity.ts` — Add 24/7 Operational Directive

Add a new section to `VIZZY_CORE_IDENTITY`:

```
═══ 24/7 ALWAYS-ON OPERATIONAL MODE ═══
You are ALWAYS active — 24 hours, 7 days a week, 365 days a year.
You never sleep. You never go offline. You are the always-on guardian of the business.

DANGER ALERT PROTOCOL:
When ANY of these are detected, the CEO is immediately texted at +14165870788:
- Broken integrations (RingCentral, Gmail, QuickBooks disconnected)
- Missed deliveries or scheduling failures
- Overdue invoices exceeding $5,000
- Employee shifts exceeding 12 hours
- Production stalls (machines idle during active queue)
- Security anomalies or unauthorized access attempts
- Any system error that could impact revenue or safety

You handle EVERYTHING you can autonomously:
- Answer every call like a human — warm, knowledgeable, helpful
- Capture every opportunity — RFQs, leads, inquiries
- Monitor all systems continuously via watchdog
- Only escalate to the CEO when human judgment or approval is required
```

~15 lines added.

### 4. `supabase/functions/push-on-notify/index.ts` — Ensure Danger Notifications Always SMS

The current SMS trigger fires for `call_summary`, `rfq_approval`, `callback_request`, and `priority: "high"`. Add watchdog alert types to the SMS trigger list:
- `watchdog_alert` (or whatever type the watchdog uses)
- Any notification with `agent_name: "watchdog"`

~5 lines updated.

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/vizzy-business-watchdog/index.ts` | Import `sendCeoSmsAlert`, SMS CEO on high-priority/dangerous alerts (~10 lines) |
| `supabase/functions/_shared/vizzyIdentity.ts` | Add 24/7 always-on directive + danger alert protocol (~15 lines) |
| `supabase/functions/vizzy-call-receptionist/index.ts` | Add "always available" reinforcement to both prompt modes (~3 lines) |
| `supabase/functions/push-on-notify/index.ts` | Add watchdog alert types to SMS trigger list (~5 lines) |

## Important Note on Call Handling

The `VizzyCallHandler` component runs in the browser — it requires the CEO's browser to be open. This is a WebRTC limitation. The watchdog, SMS alerts, and all backend monitoring run 24/7 on the server via cron regardless of browser state. The call answering system works whenever the app is open (it doesn't need to be in focus — just loaded in a tab).

## Impact
- 4 files updated
- CEO gets SMS on phone for any dangerous business event — day or night
- Vizzy identity reinforced as 24/7 always-on operator
- Watchdog alerts now trigger SMS, not just in-app notifications
- No database or auth changes

