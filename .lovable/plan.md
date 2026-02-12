

# Fix Penny Returning All-Zero Financial Reports

## Root Cause

The edge function logs reveal a clear error repeating every time Penny is used:

```
ReferenceError: svcClient is not defined
    at fetchContext (ai-agent/index.ts:1885)
```

The `fetchContext` function calls `fetchQuickBooksLiveContext(svcClient, context)` on line 1995, but `svcClient` is **not in scope** inside `fetchContext`. It's defined later in the main request handler (line 2763). This means:

- Every call to Penny crashes the context-fetching step
- Penny gets **zero financial data** (no invoices, no P&L, no customers)
- She responds with all-$0.00 reports because she has nothing to work with
- The same bug exists on line 2132 (for the assistant/Vizzy agent)

## Fix

Add `svcClient` as a parameter to `fetchContext` so it can pass it to `fetchQuickBooksLiveContext`.

### Technical Changes

**File: `supabase/functions/ai-agent/index.ts`**

1. **Update function signature** (line 1912): Add a `svcClient` parameter

```typescript
async function fetchContext(
  supabase: ReturnType<typeof createClient>,
  agent: string,
  userId?: string,
  userEmail?: string,
  userRolesList?: string[],
  svcClient?: ReturnType<typeof createClient>
)
```

2. **Guard the two call sites** (lines 1995 and 2132): Only call `fetchQuickBooksLiveContext` if `svcClient` is provided

```typescript
if (svcClient) {
  await fetchQuickBooksLiveContext(svcClient, context);
}
```

3. **Update the caller** (line 2812): Pass `svcClient` as the new argument

```typescript
const dbContext = await fetchContext(supabase, agent, user.id, userEmail, roles, svcClient);
```

4. **Redeploy** the `ai-agent` edge function

## Expected Result

After this fix, Penny will receive live QuickBooks data (invoices, payments, P&L, balance sheet, accounts) and will be able to populate the Monthly Financial Snapshot with real numbers instead of all zeros.

## Scope
- 1 file modified: `supabase/functions/ai-agent/index.ts` (3 small edits)
- Redeploy `ai-agent` edge function
