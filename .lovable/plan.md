

# Fix: Vizzy QB "Unauthorized" — Missing User ID Header

## Root Cause

When `admin-chat` calls `quickbooks-oauth` at line 2420, it uses the **service role key** for authorization but does NOT pass the `x-qb-user-id` header. The `quickbooks-oauth` handler (line 342) checks:

```
if (!userId && !qbUserIdOverride) return 401 "Unauthorized"
```

With a service role JWT, `userId` is empty. Without `x-qb-user-id`, `qbUserIdOverride` is also empty. Result: every QB report request from Vizzy gets a 401.

This is purely a missing header — the QB OAuth tokens and connection are fine.

## Fix

### File: `supabase/functions/admin-chat/index.ts` (line ~2420)

Add `x-qb-user-id: authedUserId` header to the fetch call to `quickbooks-oauth`:

```typescript
// Before
headers: { "Content-Type": "application/json", "Authorization": `Bearer ${svcKey}` },

// After
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${svcKey}`,
  "x-qb-user-id": authedUserId,
},
```

Same fix needed for the `trigger_qb_sync` case (~line 2485) if it also calls an edge function with service role key.

## Impact

- 1 file, ~2 lines changed
- Vizzy can pull live AR/AP reports immediately
- No database, UI, or auth changes
- QB connection does not need re-authorization

