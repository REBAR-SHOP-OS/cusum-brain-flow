

# Fix: Unblock Migration Pipeline for odoo_id Unique Index

## Root Cause
Three migrations attempt to create `idx_leads_odoo_id_unique`:
1. `20260304234951` — Creates unique index **without dedup** → FAILS on duplicate `3083` → blocks ALL subsequent migrations
2. `20260305031029` — Dedup + create index (never reaches because #1 fails)
3. `20260305144441` — Dedup + create index (never reaches because #1 fails)

## Fix

### 1. Edit `20260304234951_f3b11fd1-...sql`
Add the dedup DELETE before CREATE UNIQUE INDEX so it succeeds on first run:
```sql
DELETE FROM leads a USING leads b
WHERE a.id < b.id
  AND a.metadata->>'odoo_id' IS NOT NULL
  AND a.metadata->>'odoo_id' = b.metadata->>'odoo_id';

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_odoo_id_unique
  ON leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;
```

### 2. Edit `20260305031029_a8c55015-...sql`
Make idempotent (no-op if index already exists):
```sql
-- Already handled by earlier migration
SELECT 1;
```

### 3. Edit `20260305144441_4a7998d1-...sql`
Same — make idempotent no-op:
```sql
-- Already handled by earlier migration
SELECT 1;
```

This preserves all `odoo_id` data, deduplicates only true duplicates (keeping the latest), and unblocks the entire migration pipeline.

