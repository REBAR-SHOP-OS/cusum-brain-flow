

# Speed Up Odoo CRM Import

## Current Situation
- **741 of 2,661** Odoo leads have been imported so far
- The function times out (~60s limit) because each lead requires multiple DB queries (customer lookup, contact check, lead insert, activity log)
- Re-running is safe (dedup via `source_email_id`) but slow -- each run only gets ~200 leads

## Recommended Approach: Batch Processing with Pagination

### 1. Add pagination to Odoo fetch
Instead of fetching all 2,661 leads at once, fetch in pages of 200. Process only un-synced ones by checking against existing `source_email_id` values upfront.

### 2. Skip already-synced leads early  
Before the main loop, load all existing `odoo_crm_*` source IDs in one query. Skip known IDs immediately without any DB writes -- this is the biggest time saver on re-runs.

### 3. Batch customer lookups
Instead of querying customers one-by-one inside the loop, pre-fetch all existing customers for the company in a single query and use an in-memory map for lookups.

### 4. Batch inserts where possible
Group new leads and insert them in batches of 50 instead of one-at-a-time, dramatically reducing round-trips.

## Technical Details

**File:** `supabase/functions/sync-odoo-leads/index.ts`

| Change | Why |
|--------|-----|
| Add `limit` and `offset` params to `odooSearchRead` calls | Paginate Odoo fetch to avoid memory issues |
| Pre-load all existing `source_email_id` values matching `odoo_crm_%` | Skip already-imported leads instantly on re-runs |
| Pre-fetch all customers for `company_id` into a `Map<name, id>` | Eliminate per-lead customer query |
| Batch `leads` inserts (groups of 50) | Reduce DB round-trips from ~2000 to ~40 |
| Add a time guard (~50s) to return partial results before timeout | Graceful exit with progress report |
| Return `{ remaining: true }` flag so the UI knows to re-trigger | Enable automatic continuation |

**Estimated runs to complete:** 1-2 more runs (down from ~10+ currently)

After the import completes, the sync function will remain useful for ongoing incremental syncs (new/updated leads only), which will be fast since most leads will be skipped.

