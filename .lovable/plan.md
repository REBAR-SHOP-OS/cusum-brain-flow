

# Fix: Odoo Sync — Deduplicate, Chain Chatter, Prevent Future Duplicates

## Problems Confirmed

| Issue | Evidence |
|-------|----------|
| 181 duplicate lead pairs (same odoo_id) | Previous cleanup incomplete; unique index never created (migration failed) |
| 203 leads have zero chatter/activities | Chatter sync is a separate function never called by the Odoo Sync button |
| No unique index on odoo_id | Index creation failed because duplicates still existed |
| Lead detail shows "No activities yet" | Chatter tab queries `lead_activities` which is empty for these leads |

## Plan

### Step 1: Deduplicate 181 remaining lead pairs (SQL data fix)

Re-run the deduplication: for each duplicated `metadata->>'odoo_id'`, keep the older lead (first `created_at`), migrate child records (`lead_activities`, `lead_events`, `lead_files`, `lead_communications`) from the duplicate to the keeper, then delete the duplicate.

### Step 2: Create unique index to prevent future duplicates

Once duplicates are gone, create the partial unique index:
```sql
CREATE UNIQUE INDEX idx_leads_odoo_id_unique 
ON leads ((metadata->>'odoo_id')) 
WHERE metadata->>'odoo_id' IS NOT NULL;
```

### Step 3: Chain chatter sync into Odoo Sync button

Modify `handleOdooSync` in `Pipeline.tsx` to call `odoo-chatter-sync` automatically after `odoo-crm-sync` completes successfully. This ensures every sync also pulls chatter messages and scheduled activities — making the lead detail identical to Odoo.

```typescript
// After odoo-crm-sync succeeds:
const { data: chatterData } = await supabase.functions.invoke("odoo-chatter-sync", { body: { mode: "missing" } });
```

The "missing" mode only syncs leads that have zero activities, so it's safe to run repeatedly without creating duplicates (the chatter sync already deduplicates by `odoo_message_id`).

### Step 4: Update `odoo-crm-sync` to use upsert logic

Change the insert path in `odoo-crm-sync` to use the unique index for conflict resolution, preventing duplicates even if two syncs run simultaneously:
```sql
-- Instead of insert, use upsert on metadata->>'odoo_id'
```
This requires modifying the edge function to check for existing odoo_id before inserting.

| File | Change |
|------|--------|
| Database (data fix) | Dedup 181 pairs, migrate children, create unique index |
| `src/pages/Pipeline.tsx` | Chain `odoo-chatter-sync` after `odoo-crm-sync` in `handleOdooSync` |
| `supabase/functions/odoo-crm-sync/index.ts` | Harden insert path to prevent duplicate creation |

