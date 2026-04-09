

# Audit & Fix: Email/Call Alert Reconciliation System

## Problems Identified

### Problem 1: Neel's email appears in Sattar's "To Respond"
**Root cause**: The alert system sends the unanswered-email alert to BOTH the owner (neel@rebar.shop) AND the CEO (sattar@rebar.shop). When Gmail syncs Sattar's inbox, the alert email `[Alert] Unanswered email - 24h - Request for quote` arrives with `to_address = "neel@rebar.shop"` in the original email data. The inbox categorization has **no concept of "this is someone else's responsibility"** — it defaults to "To Respond" for any email without AI classification, including alert emails about other people's unanswered items.

Additionally, alert emails from `ai@rebar.shop` are NOT in the `SKIP_SENDERS` list for inbox categorization, so they show up as actionable items.

### Problem 2: No sent-box reconciliation before alerts
The `comms-alerts` function DOES check for outbound replies (lines 302-321) via thread_id and direct-reply matching. However, it only checks the `communications` table — if a reply was sent but Gmail sync hasn't run yet, the reply won't be in the DB and a false alert fires.

### Problem 3: No callback check before missed-call alerts
The missed-call alert logic (lines 343-375) has **zero outbound call reconciliation**. It fires an alert for every missed call without checking if someone called back.

### Problem 4: Scam/spam emails trigger alerts
The `shouldSkipAlert` function has sender patterns but no content-based spam detection (no `analyzeSpam` integration).

---

## Plan

### 1. Fix Inbox Categorization — Alert emails → "Notification" not "To Respond"
**File: `src/components/inbox/inboxCategorization.ts`**

In `categorizeCommunication()`, add an early check: if `from` contains `ai@rebar.shop` (the alert sender), categorize as "Notification" instead of falling through to "To Respond". This prevents ALL alert emails from showing as actionable items.

Additionally, add TO/CC-based logic (from the previously approved plan):
- If the logged-in user's email matches the `to_address` → keep current label (DIRECT)
- If the user is only in CC → force label to "FYI"
- Alert emails always → "Notification"

### 2. Fix Missed Call Alerts — Add callback reconciliation
**File: `supabase/functions/comms-alerts/index.ts`**

In the missed-call alert section (after line 353), before creating an alert:
- Query `communications` for an outbound call to the same `from_address` (phone number) after the missed call's `received_at`
- If an outbound call exists → skip alert (callback was made)

```
// Pseudocode:
const callerPhone = comm.from_address;
const { count: callbackExists } = await svc
  .from("communications")
  .select("id", { count: "exact", head: true })
  .eq("source", "ringcentral")
  .eq("direction", "outbound")
  .ilike("to_address", `%${callerPhone}%`)
  .gt("received_at", comm.received_at);
if (callbackExists && callbackExists > 0) continue;
```

### 3. Add Spam Filter to comms-alerts
**File: `supabase/functions/comms-alerts/index.ts`**

Import `analyzeSpam` from `../_shared/spamFilter.ts` and add a spam check in the unanswered email loop — if `analyzeSpam(subject + preview, from_address).isSpam`, skip the alert.

### 4. Update Vizzy System Prompt — Reconciliation rule
**File: `supabase/functions/_shared/vizzyIdentity.ts`**

Add to the alert/monitoring section:
- "Always check sent box / outbound calls before flagging unanswered"
- "Do not alert for scam/spam emails"
- "If person is in CC, classify as FYI not actionable"

---

## Files Modified
| File | Change |
|------|--------|
| `src/components/inbox/inboxCategorization.ts` | Add `ai@rebar.shop` → Notification; add TO vs CC logic |
| `supabase/functions/comms-alerts/index.ts` | Add callback reconciliation for missed calls; add spam filter |
| `supabase/functions/_shared/vizzyIdentity.ts` | Add reconciliation-before-alert rules |

## Result
- Alert emails from ai@rebar.shop → "Notification" column (not "To Respond")
- Missed call alerts only fire when no callback was made
- Spam/scam emails never trigger alerts
- Emails where user is CC'd → "FYI" not "To Respond"

