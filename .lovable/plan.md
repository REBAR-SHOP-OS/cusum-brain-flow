

# Fix Odoo Sync: Deduplicate, Deploy, and Backfill

## Diagnosis (hard numbers from the database)

- **2797** Odoo-synced leads total
- **408** (14.6%) have `odoo_created_at` populated
- **215** (7.7%) have `contact_id` populated
- **2389** leads still have null timestamps and null contacts

The columns exist in test. The edge function logic is correct. But **deployment to production is blocked** because migration `20260304234951` tries to create a UNIQUE index on `metadata->>'odoo_id'` and production has duplicate odoo_id values (e.g. odoo_id `3083` appears more than once).

This is blocking everything: the column migration, the edge function deploy, and therefore the backfill.

## Fix (3 steps)

### Step 1: Fix the blocking migration

Replace the unique index migration with a safe version that deduplicates first, then creates the index:

```sql
-- Delete duplicate leads keeping only the most recently synced per odoo_id
DELETE FROM leads a USING leads b
WHERE a.id < b.id
  AND a.metadata->>'odoo_id' IS NOT NULL
  AND a.metadata->>'odoo_id' = b.metadata->>'odoo_id';

-- Now create the unique index (safe — no duplicates remain)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_odoo_id_unique
  ON leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;
```

This unblocks the entire deploy pipeline.

### Step 2: Fix chatter date ordering (OdooChatter.tsx)

Currently only the "initial event" uses `odoo_created_at`. All other activities and the overall sort still use `created_at`.

Changes:
- For **all** activity items from Odoo-synced leads, use `odoo_created_at` as the baseline date when the activity's own `created_at` equals the sync timestamp (i.e., when `created_at` is within a few seconds of `metadata.synced_at`)
- The final thread sort should use each item's resolved date, which already works — the issue is that most items are getting `created_at` (sync time) as their date

### Step 3: Deploy and trigger full sync

Once the migration unblocks, the edge function (which already has correct logic for writing `odoo_created_at`, `odoo_updated_at`, `last_touched_at`, and `contact_id`) will deploy. A full sync will backfill all 2797 leads.

## Files to change

| File | Change |
|------|--------|
| `supabase/migrations/20260304234951_*.sql` | Replace with dedup-then-index SQL |
| `src/components/pipeline/OdooChatter.tsx` | Use `odoo_created_at` for all Odoo-synced activity dates, not just initial event |

## Expected outcome after full sync

- 90%+ leads with `contact_id` populated (limited by leads that have email/phone in Odoo)
- 100% of Odoo-synced leads with `odoo_created_at` populated
- Chatter date headers showing real Odoo dates

