

# Fix: QuickBooks Report Calls Fail with "User has no company assigned"

## Root Cause

When Vizzy (admin-chat) calls `quickbooks-oauth` to fetch a live report, it passes:
- `Authorization: Bearer ${serviceRoleKey}` (not a real user token)
- `x-qb-user-id: <actual-user-id>` header

The `quickbooks-oauth` function stores the override as `body._qbUserId` (line 486-488), but then passes the original `ctx.userId` (from the service role token — which has no profile row) to all report handlers. Only `handleCreateInvoice` actually checks for `body._qbUserId`.

So every report handler calls `getUserCompanyId(supabase, serviceRoleUserId)` → profile not found → **"User has no company assigned"**.

## Fix

**File: `supabase/functions/quickbooks-oauth/index.ts`**, lines 480-488

After resolving `qbUserIdOverride`, override the `userId` variable itself so ALL downstream handlers automatically use the correct user:

```typescript
// Line ~482-488 — replace current block:
let effectiveUserId = ctx.userId;
const qbUserIdOverride = rawReq.headers.get("x-qb-user-id");
if (qbUserIdOverride) {
  effectiveUserId = qbUserIdOverride;
  body._qbUserId = qbUserIdOverride;
}
```

Then replace all occurrences of `userId` in the switch-case routing (lines 516-690) with `effectiveUserId`. This is a single variable rename at the top — every `handleXxx(supabase, userId, ...)` call automatically gets the correct user.

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/quickbooks-oauth/index.ts` | Use `effectiveUserId` from `x-qb-user-id` header for all handler routing |

## Result
- All QB report calls from Vizzy will correctly resolve the CEO's company and QB connection
- No more "User has no company assigned" errors
- Existing direct-user calls unaffected (effectiveUserId = ctx.userId when no override header)

