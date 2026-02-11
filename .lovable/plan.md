

## Fix: Vizzy's Empty Business Context (Race Condition)

### Root Cause
`useVizzyContext` calls `qb.loadAll()` which sets React state internally (`setInvoices(...)`, etc.), then immediately reads `qb.totalReceivable`, `qb.accounts`, etc. But React state updates don't take effect until the next render -- so every value is still at its initial default (0, empty arrays). Vizzy receives a context full of zeros and "None" entries, so she makes things up or gives generic answers.

### The Fix
Bypass the QuickBooks React hook entirely inside `loadFullContext`. Instead, call the QuickBooks edge function directly from Supabase to get raw financial data, then build the snapshot from those raw results -- no React state dependency.

### Changes

**File: `src/hooks/useVizzyContext.ts`**

Replace the QuickBooks hook dependency with a direct Supabase function call:

1. Remove the `useQuickBooksData()` import/usage from this hook
2. Inside `loadFullContext`, call `supabase.functions.invoke("quickbooks-oauth", { body: { action: "dashboard-summary" } })` directly to get invoices, bills, payments, and accounts as raw data
3. Compute `totalReceivable`, `totalPayable`, `overdueInvoices`, `overdueBills` from those raw arrays right there -- not from React state
4. Remove the `loadedRef` cache so context is always fresh on each session start

**File: `src/components/vizzy/VoiceVizzy.tsx`**

Remove the pre-load `useEffect` that eagerly calls `loadFullContext()` on mount (since there's no longer a cache to warm, this just wastes a call). The context will be loaded fresh when the session actually starts.

### Why This Works
By reading raw API data instead of React state values, we guarantee the snapshot has actual numbers. No more race condition, no more zeros, no more hallucinated data.

### Files Modified
- `src/hooks/useVizzyContext.ts`
- `src/components/vizzy/VoiceVizzy.tsx`
