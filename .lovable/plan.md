

# Pipeline Duplicate Cleanup — Safe Execution Plan

## Verified Data Audit

| What | Count | Child Data on Duplicates |
|------|-------|--------------------------|
| Duplicate lead pairs (same odoo_id) | 233 pairs (466 rows) | 59 activities, 482 events, 960 sync_logs, 0 files, 0 orders, 0 quotes, 0 comms |
| Duplicate customer groups | 19 companies (39 extra rows) | 16 contacts, 28 quotes on "loser" records |
| Archived orphans | 33 leads | No children |

**No FK constraints exist on the leads table** — all child tables use soft references (column exists but no constraint). This means we must manually re-link before deleting.

## Execution Steps (all using the data insert/update tool, not migrations)

### Step 1: Re-link duplicate lead children to keepers

For each of the 233 duplicate pairs, the **older** lead (rn=1) is the keeper. Before deleting rn=2 leads, move their child records:

```sql
-- 1A: Move 59 lead_activities from duplicates to keepers
WITH pairs AS (
  SELECT metadata->>'odoo_id' as oid,
    MIN(CASE WHEN rn=1 THEN id END) as keeper,
    MIN(CASE WHEN rn=2 THEN id END) as dupe
  FROM (
    SELECT id, metadata->>'odoo_id' as odoo_id,
      ROW_NUMBER() OVER (PARTITION BY metadata->>'odoo_id' ORDER BY created_at) as rn
    FROM leads WHERE metadata->>'odoo_id' IS NOT NULL
    AND metadata->>'odoo_id' IN (
      SELECT metadata->>'odoo_id' FROM leads GROUP BY 1 HAVING count(*)>1
    )
  ) sub GROUP BY metadata->>'odoo_id'
)
UPDATE lead_activities SET lead_id = p.keeper
FROM pairs p WHERE lead_activities.lead_id = p.dupe;

-- 1B: Move 482 lead_events
-- (same pattern, UPDATE lead_events)

-- 1C: Delete 960 sync_validation_log entries (disposable logs)
-- DELETE FROM sync_validation_log WHERE lead_id IN (SELECT dupe FROM pairs)
```

### Step 2: Delete 233 duplicate leads

```sql
DELETE FROM leads WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY metadata->>'odoo_id' ORDER BY created_at
    ) as rn FROM leads WHERE metadata->>'odoo_id' IS NOT NULL
    AND metadata->>'odoo_id' IN (
      SELECT metadata->>'odoo_id' FROM leads GROUP BY 1 HAVING count(*)>1
    )
  ) sub WHERE rn = 2
);
```

### Step 3: Merge 19 duplicate customers

For each duplicate company, keep the one with the most leads. Re-link children from losers:

- Re-link 28 quotes (`UPDATE quotes SET customer_id = keeper WHERE customer_id = loser`)
- Re-link 16 contacts (`UPDATE contacts SET customer_id = keeper WHERE customer_id = loser`)
- Re-link leads (`UPDATE leads SET customer_id = keeper WHERE customer_id = loser`)
- Mark losers as archived with `merged_into_customer_id` set (using the existing merge pattern from the ERP connector)

### Step 4: Purge 33 archived orphans

```sql
DELETE FROM leads WHERE stage = 'archived_orphan' AND customer_id IS NULL;
```

### Step 5: Add unique index to prevent future duplicates

This is a **schema change** (migration tool):

```sql
CREATE UNIQUE INDEX idx_leads_odoo_id_unique 
ON leads ((metadata->>'odoo_id')) 
WHERE metadata->>'odoo_id' IS NOT NULL;
```

## Safety Guarantees

- Every child record is re-linked before its parent is deleted — zero data loss
- Sync logs (disposable) are deleted, not moved
- Customer "losers" are archived with merge audit trail, not hard-deleted
- Unique index prevents this from happening again
- All operations use explicit WHERE clauses tied to the CTE ranking — no accidental broad deletes

| Step | Tool | Records Affected |
|------|------|-----------------|
| Re-link lead children | insert tool (UPDATE) | 59 activities + 482 events moved |
| Delete sync logs | insert tool (DELETE) | 960 rows |
| Delete dupe leads | insert tool (DELETE) | 233 rows |
| Merge customer children | insert tool (UPDATE) | 28 quotes + 16 contacts + leads |
| Archive loser customers | insert tool (UPDATE) | ~20 rows |
| Purge orphan leads | insert tool (DELETE) | 33 rows |
| Unique index | migration tool | Schema change |

