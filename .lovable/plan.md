

# Sync Missing Odoo Chatter & Activities -- Apple to Apple

## Problem
- 384 out of 2,764 leads have ZERO activities in the ERP (no chatter, no notes, no log notes)
- ALL Odoo scheduled activities (`mail.activity`) are missing -- 0 rows in `scheduled_activities`
- The existing `odoo-crm-sync` only syncs lead metadata (stage, value) but NEVER imports Odoo's chatter messages or scheduled activities
- The UI code works perfectly -- it just has no data to show for these 384 leads

## Data Audit (Current State)

```text
+------------------------------+---------+
| Metric                       | Count   |
+------------------------------+---------+
| Total Odoo leads in ERP      | 2,764   |
| Leads WITH activities        | 2,380   |
| Leads WITHOUT activities     | 384     |
| Total lead_activities rows   | 38,472  |
| Total scheduled_activities   | 0       |
| Total lead_events            | 530     |
+------------------------------+---------+
```

## Solution: New Edge Function `odoo-chatter-sync`

### What it does:
1. For all 384 leads missing activities, fetch `mail.message` records from Odoo using the lead's `odoo_id`
2. Also fetch `mail.activity` (scheduled activities) from Odoo for ALL leads
3. Insert into `lead_activities` and `scheduled_activities` tables with dedup

### Step 1: Create `supabase/functions/odoo-chatter-sync/index.ts`

This function will:
- Query all ERP leads that have an `odoo_id` in metadata but zero `lead_activities`
- For each, call Odoo RPC to read `mail.message` records linked to the `crm.lead` model
- Map Odoo message types to ERP activity types:
  - `comment` (log notes) -> `note` 
  - `email` -> `email`
  - `notification` (stage changes) -> `system`
- Insert into `lead_activities` with `odoo_message_id` for dedup
- Also fetch `mail.activity` records and insert into `scheduled_activities`

### Step 2: Odoo `mail.message` fields to fetch

```text
Odoo Model: mail.message
Filter: res_model = 'crm.lead', res_id IN [list of odoo_ids]
Fields: id, body, subject, message_type, subtype_id, author_id, date, res_id
```

### Step 3: Odoo `mail.activity` fields to fetch

```text
Odoo Model: mail.activity
Filter: res_model = 'crm.lead', res_id IN [list of odoo_ids]  
Fields: id, summary, note, activity_type_id, date_deadline, user_id, state, res_id
```

### Step 4: Mapping Logic

For `mail.message` -> `lead_activities`:
- `message_type = 'comment'` -> `activity_type = 'comment'` or `'note'`
- `message_type = 'email'` -> `activity_type = 'email'`
- `message_type = 'notification'` -> `activity_type = 'system'`
- `author_id[1]` -> `created_by` (Odoo user name)
- `date` -> `created_at`
- `body` -> `description` (HTML stripped)
- `subject` -> `title`
- Dedup key: `odoo_message_id` column (already exists in schema)

For `mail.activity` -> `scheduled_activities`:
- `activity_type_id` -> map to `call`, `email`, `meeting`, `todo`, `follow_up`
- `summary` -> `summary`
- `note` -> `note`
- `date_deadline` -> `due_date`
- `user_id[1]` -> `assigned_name`
- `state` = 'done' -> `status = 'done'`, else `status = 'planned'`

### Step 5: Batch Processing

- Process in batches of 50 Odoo IDs per RPC call (Odoo limit)
- Insert in batches of 100 rows
- Use `odoo_message_id` for upsert/dedup to prevent duplicates on re-run

## Files to Create/Modify

### New file: `supabase/functions/odoo-chatter-sync/index.ts`
- Full edge function implementing the sync logic above
- Reuses existing `_shared/auth.ts` for authentication
- Uses same Odoo RPC pattern as `odoo-crm-sync`
- Supports `mode: "missing"` (only 384 missing) and `mode: "full"` (re-sync all)

### No UI changes needed
- The existing `OdooChatter.tsx`, `ScheduledActivities.tsx`, and `LeadDetailDrawer.tsx` already correctly render data when it exists
- Once data is synced, all tabs will populate automatically

## Execution Plan
1. Create the edge function
2. Deploy it
3. Test with a single lead first (the one you opened: odoo_id 4842)
4. Run full sync for all 384 missing leads
5. Then run `mail.activity` sync for scheduled activities across all leads

## No changes to:
- Database schema (tables already exist with correct columns)
- RLS policies (already configured correctly)
- UI components (already working, just need data)
- Existing sync functions

