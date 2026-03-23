

## Fix: Odoo Sync Timeout on Full Sync (2,965 leads)

### Root Cause

The `odoo-crm-sync` edge function successfully fetches all 2,965 leads from Odoo (logs confirm this), but then **times out during processing** because it processes each lead sequentially with individual DB queries:

1. For each of ~3,000 leads, it runs a customer lookup query (`customers` table)
2. If no customer found, it inserts a new one
3. Then upserts the lead
4. Then logs lead events for stage changes

That's potentially 6,000+ individual DB queries executed one-by-one. Edge functions have a ~60s execution limit, and this easily exceeds it.

### Fix Strategy: Batch Processing

**File**: `supabase/functions/odoo-crm-sync/index.ts`

#### Change 1: Pre-load all customers in one query

Instead of querying `customers` table per-lead (~3,000 queries), load ALL customers for the company in a single paginated query upfront and build an in-memory lookup map.

```text
BEFORE: 3,000 individual SELECT queries to customers table
AFTER:  1 paginated query → Map<name_lowercase, customer_id>
```

#### Change 2: Batch customer inserts

Collect all new customer names first, then insert them in batches of 100 instead of one-by-one.

#### Change 3: Batch lead upserts

Instead of upserting leads one at a time, collect upsert payloads and execute in batches of 50-100 using `.upsert()` with arrays.

#### Change 4: Batch lead event inserts

Collect all lead events and insert them in batches at the end instead of per-lead.

### Expected Impact

- **Before**: ~6,000+ sequential DB queries → timeout at ~60s
- **After**: ~20-30 batched queries → completes in ~10-15s

### Files Changed

| File | Change | Category |
|---|---|---|
| `supabase/functions/odoo-crm-sync/index.ts` | Batch customer resolution, lead upserts, and event inserts | Performance fix |

### What is NOT Changed
- Odoo API calls unchanged (already paginated)
- Validation logic unchanged
- Dedup/reconciliation logic unchanged
- No schema changes

