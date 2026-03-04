

# Full App Mapping Audit — Findings & Fix Plan

## Audit Results

| Area | Status | Issue | Severity |
|------|--------|-------|----------|
| Lead duplicates (odoo_id) | CLEAN | 0 duplicates, unique index active | None |
| Lead → Customer FK integrity | CLEAN | 0 broken references | None |
| Lead files duplicates | CLEAN | 0 duplicates | None |
| Lead activities (chatter) duplicates | CLEAN | 0 duplicates (dedup by odoo_message_id works) | None |
| Lead activities orphans | CLEAN | 0 pointing to deleted leads | None |
| **Scheduled activities duplicates** | **CRITICAL** | **10,338 rows but only 662 unique — 9,676 are duplicates (up to 20x each)** | Critical |
| **Leads missing chatter** | **Medium** | 62 Odoo leads have zero activities/communications | Medium |
| **Duplicate customers** | **Medium** | 17 company names duplicated (excluding test data) — e.g. MY STORAGE x3, BUILD TRUS x3, SPARTAN CONCRETE x3 | Medium |
| Orphan leads (archived_orphan) | Low | 10 remaining archived_orphan leads | Low |
| Leads with null customer_id | Low | 18 leads (mostly email-sourced, not Odoo) | Low |
| Unmapped stages | Low | 10 leads in `archived_orphan` (not in pipeline stage order) | Low |
| Customer → Odoo stage mapping | CLEAN | STAGE_MAP covers all Odoo stages | None |
| Lead events dedup | CLEAN | Uses dedupe_key upsert | None |
| Lead files → storage reconciliation | CLEAN | Fixed in prior session | None |

## Root Causes

### 1. Scheduled Activities — No Dedup (CRITICAL)
In `odoo-chatter-sync/index.ts` line 302, there's a comment: `"no upsert — scheduled_activities doesn't have odoo dedup column"`. Every sync run re-inserts ALL Odoo `mail.activity` records without checking for existing ones. This means each sync multiplies the data by 1x.

### 2. Customer Creation — Case-Sensitive Name Match
In `odoo-crm-sync/index.ts` line 278-284, customer lookup uses `.eq("name", customerName)` which is case-sensitive. "NORTHFLEET GROUP" and "Northfleet Group" create separate records.

### 3. Missing Chatter — "missing" Mode Only Checks lead_activities
The chatter sync's "missing" mode (line 140) only checks if `lead_activities` is empty, but doesn't re-check if scheduled activities were synced. The 62 leads may be recently added leads that haven't had chatter sync run since their creation.

## Fix Plan

### Step 1: SQL — Deduplicate 9,676 scheduled_activities

Keep only one row per unique `(entity_id, activity_type, summary, due_date)` combination, delete the rest.

```sql
DELETE FROM scheduled_activities
WHERE id NOT IN (
  SELECT MIN(id) FROM scheduled_activities
  WHERE entity_type = 'lead'
  GROUP BY entity_id, activity_type, summary, due_date
)
AND entity_type = 'lead';
```

**Expected**: Delete ~9,676 rows, keep 662 unique activities.

### Step 2: SQL — Add unique index on scheduled_activities to prevent re-duplication

```sql
CREATE UNIQUE INDEX idx_scheduled_activities_dedup 
ON scheduled_activities (entity_id, activity_type, summary, due_date)
WHERE entity_type = 'lead';
```

### Step 3: Fix `odoo-chatter-sync/index.ts` — Use upsert for scheduled_activities

Change the insert at line 303-306 to use `ON CONFLICT DO NOTHING` with the new unique index, so re-running the sync is safe.

```typescript
// Instead of blind insert:
const { error } = await serviceClient.from("scheduled_activities")
  .upsert(chunk, { onConflict: "entity_id,activity_type,summary,due_date", ignoreDuplicates: true });
```

### Step 4: Fix `odoo-crm-sync/index.ts` — Case-insensitive customer lookup

Change line 281 from `.eq("name", customerName)` to `.ilike("name", customerName)` to prevent creating "SPARTAN CONCRETE" and "Spartan Concrete" as separate records.

### Step 5: SQL — Merge 17 duplicate customer groups

Same pattern as prior cleanup: keep the customer with the most leads, re-link leads/contacts/quotes from losers, archive losers with merge trail.

### Step 6: Chain chatter sync for 62 missing leads

Already implemented in Pipeline.tsx — running the Odoo Sync button will now auto-invoke chatter sync in "missing" mode, which will fill these 62 leads.

| File | Change |
|------|--------|
| Database (SQL data fix) | Delete 9,676 duplicate scheduled_activities |
| Database (migration) | Add unique index on scheduled_activities |
| Database (SQL data fix) | Merge 17 duplicate customer groups |
| `supabase/functions/odoo-chatter-sync/index.ts` | Use upsert with `ignoreDuplicates` for scheduled_activities |
| `supabase/functions/odoo-crm-sync/index.ts` | Case-insensitive customer lookup (`.ilike`) |

