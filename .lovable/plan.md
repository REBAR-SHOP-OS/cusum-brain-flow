

# Fix: Normalize QB Error Responses + Tighten Vizzy's QB Failure Behavior

## Problem
When `fetch_qb_report` gets a non-200 response from `quickbooks-oauth`, it returns raw error text (`{ success: false, error: "<raw text>" }`). The AI model sees this and improvises — claiming QB is "unauthorized" and telling the CEO to reconnect, even when the connection is fine and the failure is transient.

## Changes

### 1. `supabase/functions/admin-chat/index.ts` — Normalize QB error responses (~20 lines)

Replace the raw error return at lines 2429-2432 with structured error parsing:

```typescript
// Instead of: return JSON.stringify({ success: false, error: errText });
// Parse the status and error text to return structured output:

const status = reportRes.status;
let errorType = "unknown_error";
let userMessage = "QuickBooks report request failed.";
let retryable = true;
let needsReconnect = false;

if (status === 401) {
  errorType = "provider_auth_error";
  userMessage = "QuickBooks rejected the request after a token refresh attempt. This may be transient — retry in a moment. If it persists, reconnection may be needed.";
  needsReconnect = false; // Don't assume disconnected
  retryable = true;
} else if (status === 404) {
  errorType = "connection_not_found";
  userMessage = "No active QuickBooks connection found for this company.";
  needsReconnect = true;
  retryable = false;
} else if (status >= 500) {
  errorType = "provider_server_error";
  userMessage = "QuickBooks servers returned an error. Retry shortly.";
}

return JSON.stringify({
  success: false,
  error_type: errorType,
  user_message: userMessage,
  retryable,
  needs_reconnect: needsReconnect,
  raw_status: status,
});
```

Same normalization for `trigger_qb_sync` at lines 2491-2493.

Also wrap the catch block (line 2433) to return structured output instead of raw `e.message`.

### 2. `supabase/functions/_shared/vizzyIdentity.ts` — Add QB error handling rule (~8 lines)

After line 183, add:

```
═══ QUICKBOOKS ERROR HANDLING ═══
When a fetch_qb_report or trigger_qb_sync tool call fails:
- If the result says needs_reconnect: true → tell the CEO the QB connection needs re-authorization and direct to Integrations.
- If the result says needs_reconnect: false → report it as a temporary issue. Say "The live QuickBooks request failed — I'll retry shortly" or pull from accounting_mirror as fallback.
- NEVER say "QuickBooks is unauthorized" or "integration is disconnected" unless needs_reconnect is explicitly true.
- NEVER direct the CEO to the Integrations page unless needs_reconnect is explicitly true.
- If retryable: true, attempt the tool call once more before reporting failure.
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/admin-chat/index.ts` | Structured error parsing for `fetch_qb_report` and `trigger_qb_sync` (~25 lines) |
| `supabase/functions/_shared/vizzyIdentity.ts` | QB error handling rules (~8 lines) |

## Impact
- Vizzy stops falsely claiming QB is disconnected on transient failures
- Structured errors give the model clear signals instead of raw text to hallucinate on
- `needs_reconnect` flag is the single source of truth for reconnection guidance
- No database, auth, or UI changes

