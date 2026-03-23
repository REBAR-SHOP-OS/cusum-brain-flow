

## RingCentral Status Check + Fix Vizzy Email Capability

### Findings

**RingCentral Integration:**
- Last synced call data: **March 20** (3 days ago)
- Last `last_sync_at`: March 20 00:59 UTC
- The cron job runs every 5 min but produces **zero log output** (only boot/shutdown) — the sync is silently failing
- All recent calls show **"IP Phone Offline"** as the result
- The `integration_connections` status still shows "connected" with no error — so the UI doesn't flag the problem
- Active calls API returned a JSON parse error

**Possible root cause:** The RC token may have expired or been revoked. The `getAccessTokenForUser` call inside `syncAllUsers` is likely throwing an unhandled error or the function is timing out during token refresh. Since the function catches errors and marks status as "error" only for specific error messages (`not_connected`, `invalid_grant`), a different error type could be silently swallowed.

**Vizzy Can't Send Email (text mode):**
- The `send_email` tool exists in `agentToolExecutor.ts` and works in voice mode
- But `vizzyContext.ts` (text mode) does NOT list `send_email` as an available tool
- Text Vizzy literally doesn't know it can send emails

---

### Plan: 2 Fixes

#### Fix 1: Add `send_email` to text Vizzy's tool list

**File:** `src/lib/vizzyContext.ts` (lines ~207-218)

Add `send_email` to the ERP tools list:
```
• send_email(to, subject, body, threadId?) — Send an email via Gmail on behalf of the CEO
```

Also add an explicit instruction: "NEVER say you cannot send emails. You CAN send emails using the send_email tool."

#### Fix 2: Add robust error logging + integration status update to RC sync

**File:** `supabase/functions/ringcentral-sync/index.ts`

In the `syncAllUsers` function, wrap the entire body in a try/catch that:
1. Logs the **full error** to console before returning
2. Updates `integration_connections` status to `"error"` with the error message for ALL error types (not just `invalid_grant`)
3. This ensures the UI shows a "Reconnect" banner instead of silently appearing healthy

Also add a top-level log at function entry (`console.log("ringcentral-sync invoked")`) so we can distinguish "function never called" from "function called but failed silently."

---

### Files Changed

| File | Change |
|---|---|
| `src/lib/vizzyContext.ts` | Add `send_email` tool + "never refuse email" rule |
| `supabase/functions/ringcentral-sync/index.ts` | Add entry log + catch-all error logging + always update integration status on failure |

### What is NOT Changed
- No schema changes
- No new functions
- RingCentral cron jobs unchanged
- Voice engine unchanged (already has email capability)

