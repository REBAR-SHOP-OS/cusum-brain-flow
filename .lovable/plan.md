

# Fix: Penny Queue Shows Stale Data After QB Updates

## Root Cause

The `penny-auto-actions` edge function reads invoice balances from the `accounting_mirror` table (line 70-75). This table was **last synced on Feb 13** — 13 days ago. The `qb-sync-engine` incremental sync updates `qb_transactions` but does NOT update `accounting_mirror`. The CDC sync is also failing due to a date format issue (space instead of `+` in timezone offset).

So when you click "Clear & Rescan", penny purges the queue, then re-reads the same stale `accounting_mirror` data and recreates the same outdated items.

## Fix: Two changes needed

### 1. Update `penny-auto-actions` to force a mirror refresh before scanning

Before reading from `accounting_mirror`, call the `quickbooks-oauth` function with `action: sync_invoices` to refresh the mirror with current QB data. This replaces the current `qb-sync-engine` call which only updates `qb_transactions`, not the mirror.

| File | Change |
|---|---|
| `supabase/functions/penny-auto-actions/index.ts` | Replace the `qb-sync-engine` call (lines 31-50) with a call to `quickbooks-oauth` with `action: sync_invoices` to refresh `accounting_mirror` before scanning |

### 2. Fix the CDC date format in `qb-sync-engine` (bonus fix)

The CDC query uses the raw `since` timestamp which contains `+00:00` — QuickBooks rejects the space-encoded `+`. URL-encode the `since` parameter.

| File | Change |
|---|---|
| `supabase/functions/qb-sync-engine/index.ts` | Line 761: URL-encode the `since` parameter: `encodeURIComponent(since)` |

## Technical Details

**penny-auto-actions change** (lines 31-50):
```typescript
// Replace qb-sync-engine call with quickbooks-oauth sync_invoices
try {
  await fetch(`${supabaseUrl}/functions/v1/quickbooks-oauth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") || `Bearer ${svcKey}`,
    },
    body: JSON.stringify({ action: "sync_invoices" }),
    signal: syncController.signal,
  });
  console.log("[penny-auto-actions] accounting_mirror refreshed");
} catch (syncErr) {
  console.warn("[penny-auto-actions] Mirror sync failed, using cached data:", syncErr);
}
```

**qb-sync-engine CDC fix** (line 761):
```typescript
const cdcData = await qbFetch(config, `cdc?changedSince=${encodeURIComponent(since)}&entities=${TXN_TYPES.join(",")}`, ctx);
```

This ensures "Clear & Rescan" will pull fresh balances from QuickBooks, so paid invoices (like COSS CONSTRUCTION $0.66) won't reappear in the queue.

