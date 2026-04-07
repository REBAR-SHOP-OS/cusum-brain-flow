

# Fix: Gmail Sync Silently Broken for 4+ Days

## Root Cause

The `gmail-sync` edge function's cron detection compares the incoming Bearer token against `Deno.env.get("SUPABASE_ANON_KEY")`. **This env var does not exist in the Supabase edge function runtime.** Only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

Every 5-minute cron invocation follows this path:
1. `optionalAuthFull` correctly returns null (anon JWT has no `sub`)
2. Handler enters `!userId` branch
3. Compares `token === undefined` → false
4. Returns 401 Unauthorized
5. The `handleRequest` wrapper logs "Success" before checking the Response — **masking the failure**

The cron job has been returning 401 silently every 5 minutes. Last successful sync: **April 3** (manually triggered by a user login, not cron).

## Fix Plan

### File: `supabase/functions/gmail-sync/index.ts`

**Replace the broken anon-key detection with a reliable cron detection method.**

Instead of comparing tokens (which requires an unavailable env var), use the approach already proven in other functions: detect cron mode by checking if `userId` is empty AND the request has an Authorization header. Since `optionalAuthFull` already validated the JWT failed user-auth, an empty userId + present auth header = system/cron call.

Specifically, replace lines 545-560:
```typescript
if (!userId) {
  // Cron mode: optionalAuth returned no user, but request has auth header
  // This means it's a system call (pg_cron with anon/service key)
  const authHeader = rawReq.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    console.log("CRON MODE: Syncing all Gmail users");
    return await syncAllUsers(body);
  }
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### File: `supabase/functions/_shared/requestHandler.ts`

**Fix misleading "Success" log for error responses.** Move `log.done("Success")` AFTER the Response check so 401/500 responses from handlers don't get logged as successful:

```typescript
const result = await handler({ ... });

if (result instanceof Response) {
  // Log based on actual status
  if (result.status >= 400) {
    log.error("Handler returned error response", { status: result.status });
  } else {
    log.done("Success", { companyId });
  }
  return result;
}

log.done("Success", { companyId });
```

### Immediate Action

After deploying the fix, trigger a manual sync to catch up on 4 days of missed emails by calling the edge function.

## Technical Details

| What | Detail |
|------|--------|
| Broken since | ~April 3 (last manual user sync) |
| Root env var | `SUPABASE_ANON_KEY` — not available in Deno runtime |
| Cron frequency | Every 5 min (job #24) |
| Affected users | 8 Gmail accounts (all employees) |
| Silent failure | `handleRequest` logs "Success" before checking Response type |

## Impact
- 2 files changed (gmail-sync handler + requestHandler wrapper)
- Fixes silent cron failure for Gmail sync
- Fixes misleading "Success" logging for all edge functions returning error responses
- No schema, auth, or UI changes

