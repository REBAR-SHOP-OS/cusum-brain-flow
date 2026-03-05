
# Full App Mapping Audit — COMPLETED

All fixes applied on 2026-03-05.

## Results

| Fix | Status | Detail |
|-----|--------|--------|
| Scheduled activities duplicates | ✅ DONE | Deleted 9,676 dupes → 662 unique remain. Unique index `idx_scheduled_activities_dedup` active. |
| Chatter sync upsert | ✅ DONE | `odoo-chatter-sync` now uses `upsert` with `ignoreDuplicates` for scheduled_activities |
| Case-insensitive customer lookup | ✅ DONE | Both customer lookups in `odoo-crm-sync` changed from `.eq` to `.ilike` |
| Duplicate customers merged | ✅ DONE | 25 duplicate groups merged (children re-linked, losers deleted). 0 remaining. |
| Chatter chain on sync | ✅ DONE | Pipeline.tsx chains `odoo-chatter-sync` after CRM sync (done in prior session) |
| Lead odoo_id unique index | ✅ DONE | `idx_leads_odoo_id_unique` active (done in prior session) |
| CRM sync race-condition guard | ✅ DONE | 23505 fallback to update (done in prior session) |
