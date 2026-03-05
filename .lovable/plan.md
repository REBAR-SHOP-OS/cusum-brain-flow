

# Fix Root Causes: Odoo Timestamps, Contact Linking, and Stage Normalization

## What's wrong

1. **Wrong timestamps**: `leads.created_at` stores the sync date, not the original Odoo date. Chatter/UI sorts by this, causing "February 2026" headers on records from July 2025.
2. **Null contacts**: The sync creates/links `customer_id` but never populates `contact_id`. The `contacts` table exists with email/phone fields but Odoo sync ignores it entirely.
3. **No Odoo origin dates stored**: `create_date` and `write_date` from Odoo are fetched (line 13 of edge function) but never written to the leads table.

## Plan

### 1. Database migration — add 3 columns to `leads`

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS odoo_created_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS odoo_updated_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_touched_at timestamptz;
```

`last_touched_at` = `greatest(odoo_updated_at, updated_at)` — computed during sync and on local updates.

### 2. Edge function: `odoo-crm-sync/index.ts` — store Odoo dates + link contacts

**Odoo dates** (lines ~246-261, ~327-335, ~372-383):
- Parse `ol.create_date` and `ol.write_date` from Odoo response
- Write `odoo_created_at`, `odoo_updated_at`, and `last_touched_at` on both insert and update

**Contact linking** (new logic after customer resolution ~272-300):
- If `ol.email_from` or `ol.phone` exists, search `contacts` by email first, then phone, scoped to `customer_id`
- If no match found, create a new contact using `ol.contact_name` (split into first/last), `ol.email_from`, `ol.phone`, linked to the resolved `customer_id`
- Write `contact_id` on the lead insert/update payload

### 3. UI: `OdooChatter.tsx` — use Odoo dates for timeline ordering

Currently the chatter timeline uses `created_at` for date grouping. Change to prefer `lead.metadata.odoo_created_at` or `lead.odoo_created_at` where available, so date headers reflect real Odoo dates instead of sync dates.

### 4. Backfill existing leads

After migration + edge function deploy, a single "Sync Odoo" (full mode) click will:
- Backfill `odoo_created_at` / `odoo_updated_at` / `last_touched_at` for all synced leads
- Create missing contacts and populate `contact_id`

No manual backfill script needed.

## Files to change

| File | Change |
|------|--------|
| DB migration | Add `odoo_created_at`, `odoo_updated_at`, `last_touched_at` to `leads` |
| `supabase/functions/odoo-crm-sync/index.ts` | Store Odoo dates, add contact resolution logic, write `contact_id` |
| `src/components/pipeline/OdooChatter.tsx` | Use `odoo_created_at` for date headers when available |

