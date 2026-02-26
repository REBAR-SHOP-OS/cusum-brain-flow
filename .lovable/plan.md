

# QuickBooks Integration Hardening Plan

## PHASE 1 -- Dependency & Surface Audit (Complete)

### QB-Related Edge Functions

| Function | Purpose | Direction |
|----------|---------|-----------|
| `quickbooks-oauth` (1,958 lines) | OAuth flow + ALL read/write operations (60+ actions) | Bidirectional |
| `qb-sync-engine` (1,258 lines) | Backfill, incremental sync, reconcile, bank activity | Inbound (QB -> ERP) |
| `qb-webhook` (184 lines) | Receives Intuit webhook notifications | Inbound |
| `qb-audit` (72 lines) | AI-powered forensic audit of QB data | Read-only |
| `relink-orphan-invoices` | Re-links orphaned invoice mirror records | Read + repair |
| `penny-auto-actions` | Auto-collection actions, triggers QB sync | Read + AI |
| `vizzy-daily-brief` | Executive briefing with QB financials | Read-only |
| `daily-summary` | Daily digest including QB AR/AP | Read-only |
| `auto-reconcile` | AI-assisted bank reconciliation | Read + match |

### DB Tables Storing QB IDs

| Table | QB Column(s) | Unique Constraint? |
|-------|-------------|-------------------|
| `customers` | `quickbooks_id` | `onConflict: "quickbooks_id"` (upsert) |
| `orders` | `quickbooks_invoice_id` | None (checked client-side) |
| `accounting_mirror` | `quickbooks_id` | `onConflict: "quickbooks_id"` (upsert) |
| `qb_accounts` | `qb_id` | `onConflict: "company_id,qb_id"` |
| `qb_customers` | `qb_id` | `onConflict: "company_id,qb_id"` |
| `qb_vendors` | `qb_id` | `onConflict: "company_id,qb_id"` |
| `qb_items` | `qb_id` | `onConflict: "company_id,qb_id"` |
| `qb_transactions` | `qb_id` | `onConflict: "company_id,qb_id,entity_type"` |
| `qb_classes` | `qb_id` | `onConflict: "company_id,qb_id"` |
| `qb_departments` | `qb_id` | `onConflict: "company_id,qb_id"` |
| `qb_bank_activity` | `qb_account_id` | `onConflict: "company_id,qb_account_id"` |
| `qb_company_info` | `qb_realm_id` | `onConflict: "company_id,qb_realm_id"` |
| `qb_webhook_events` | `realm_id + entity_id` | **NO unique index** (only PK + realm index) |
| `qb_sync_logs` | -- | None |

### Write Paths to QB (Outbound)

All via `quickbooks-oauth`: `create-invoice`, `create-payment`, `create-bill`, `create-credit-memo`, `create-estimate`, `create-purchase-order`, `create-vendor`, `create-account`, `create-item`, `create-journal-entry`, `create-sales-receipt`, `create-refund-receipt`, `create-deposit`, `create-transfer`, `create-bill-payment`, `create-purchase`, `update-customer`, `update-vendor`, `update-invoice`, `update-employee`, `delete-transaction`, `void-transaction`, `void-invoice`, `send-invoice`, `upload-attachment`, `convert-estimate-to-invoice`

### Inbound Webhook Paths

`qb-webhook` receives Intuit notifications -> looks up company by `realm_id` -> dedup check (time-based, **not** unique index) -> inserts to `qb_webhook_events` -> triggers `qb-sync-engine` incremental sync

---

## Identified Gaps

### Security
1. **Signature verification uses non-constant-time comparison** (`computed === signature` at line 18 of qb-webhook). Vulnerable to timing attacks.
2. **Dedup is time-window based** (60-second `.gte()` query), not a unique constraint. Race conditions can allow duplicates.
3. **No unique index on webhook events** for `(realm_id, entity_type, entity_id, operation)`.

### Idempotency
4. **Invoice creation** has server-side guard only for `orderId`-linked invoices. Direct `create-invoice` calls without `orderId` have no dedup.
5. **No single-flight lock** on `qb-sync-engine`. Parallel webhook events for the same company can trigger concurrent backfill/incremental runs.

### Timeouts & Retries
6. **No fetch timeout** on QB API calls. Deno `fetch` has no built-in timeout; a hung connection blocks the edge function indefinitely.
7. **Retry logic only covers 429 and 401**. Transient server errors (502/503/504) are not retried.
8. **No jitter** in backoff calculation (`Math.min(1000 * Math.pow(2, retries), 10000)` is deterministic).

### Observability
9. **No structured logging** with `company_id`, `duration_ms`, `status_code`, `retry_count` per QB API call.
10. **Failed QB writes are not persisted** to any failure table. Console logs only.

---

## Implementation Plan

### Migration 1: Webhook Dedupe Unique Index + Sync Lock Table

```sql
-- Unique composite index for webhook dedup (replaces time-window query)
CREATE UNIQUE INDEX IF NOT EXISTS idx_qb_webhook_events_dedupe 
  ON public.qb_webhook_events (realm_id, entity_type, entity_id, operation)
  WHERE processed_at IS NULL;

-- Add dedupe_key column for stronger dedup
ALTER TABLE public.qb_webhook_events 
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT GENERATED ALWAYS AS 
    (realm_id || ':' || entity_type || ':' || entity_id || ':' || operation) STORED;

-- Sync lock table for single-flight protection
CREATE TABLE IF NOT EXISTS public.qb_sync_locks (
  company_id UUID NOT NULL,
  action TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  PRIMARY KEY (company_id, action)
);
ALTER TABLE public.qb_sync_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access qb_sync_locks" 
  ON public.qb_sync_locks FOR ALL USING (true) WITH CHECK (true);

-- QB API failure log table
CREATE TABLE IF NOT EXISTS public.qb_api_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID,
  realm_id TEXT,
  endpoint TEXT NOT NULL,
  operation TEXT,
  status_code INTEGER,
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  request_summary JSONB,
  correlation_id TEXT,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qb_api_failures_company ON public.qb_api_failures (company_id, created_at DESC);
ALTER TABLE public.qb_api_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access qb_api_failures" 
  ON public.qb_api_failures FOR ALL USING (true) WITH CHECK (true);
```

### Change 2: `qb-webhook/index.ts` -- Constant-time comparison + dedupe via unique index

- Replace `computed === signature` with a constant-time comparison using `crypto.subtle.verify` or byte-by-byte XOR comparison
- Replace the 60-second time-window dedup query with an `INSERT ... ON CONFLICT DO NOTHING` using the new unique index
- Check the insert result: if no rows returned, the event is a duplicate

### Change 3: `qb-sync-engine/index.ts` -- Single-flight lock + timeouts + structured logging

- Add `acquireLock(svc, companyId, action)` and `releaseLock(svc, companyId, action)` functions using `qb_sync_locks`
- Wrap the main handler with lock acquisition; return 409 if already locked
- Auto-expire stale locks (> 10 minutes old)
- Add `AbortController` with 15-second timeout to all `fetch()` calls inside `qbFetch`
- Extend retry logic: retry on 502/503/504 in addition to 429
- Add jitter to backoff: `delay * (0.5 + Math.random() * 0.5)`
- Add structured log entries for each QB API call: `{ company_id, realm_id, endpoint, duration_ms, status_code, retry_count }`
- On failure, insert into `qb_api_failures` table

### Change 4: `quickbooks-oauth/index.ts` -- Timeout + retry hardening on `qbFetch`

- Add `AbortController` with 15-second timeout
- Extend retry to cover 502/503/504 (transient server errors)
- Add jitter to backoff
- Never retry non-429 4xx errors
- Add structured logging helper

### Change 5: Shared utility `_shared/qbHttp.ts`

Create a shared module with:
- `constantTimeEqual(a: string, b: string): boolean` -- timing-safe string comparison
- `qbFetchWithTimeout(url, options, timeoutMs)` -- fetch wrapper with AbortController
- `isTransientError(status: number): boolean` -- returns true for 429, 502, 503, 504
- `backoffWithJitter(retryCount: number): number` -- exponential backoff with jitter

### No Changes To

- Business logic / workflows
- QuickBooks integration itself (no removal)
- UI components
- Existing `qb_sync_logs` table structure
- Any accounting rules or trial balance checks

### Risk Level: Low

All changes are additive guards. No business logic is modified. The unique index on `qb_webhook_events` uses a partial index (`WHERE processed_at IS NULL`) so it won't conflict with historical processed events.

### Deployment Order

1. Run migration (creates index + lock table + failure table)
2. Deploy `_shared/qbHttp.ts` shared utility
3. Deploy `qb-webhook` with constant-time comparison + INSERT dedup
4. Deploy `qb-sync-engine` with single-flight lock + timeout + retry hardening
5. Deploy `quickbooks-oauth` with timeout + retry hardening

