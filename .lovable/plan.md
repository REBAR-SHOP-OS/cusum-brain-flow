

# Root Cause: Migration Never Applied + Missing Tracking Data

## What I Found

### Problem 1: `odoo_message_id` column does NOT exist on `lead_files`
The migration file exists (`20260305013704_...sql`) but **the column was never actually created in production**. Every query against `lead_files.odoo_message_id` returns `column does not exist`. This means:
- The backfill in `odoo-chatter-sync` silently fails when trying to `UPDATE lead_files SET odoo_message_id = ...`
- The UI code reading `(f as any).odoo_message_id` always gets `undefined`
- ALL files appear as orphans because none can be linked to their parent message

### Problem 2: Stage change activities have `has_tracking: true` but NO `tracking_changes` array
The existing synced data stores `has_tracking: true` in metadata but the actual field-level changes (`tracking_changes`) were never populated. The UI checks for `trackingChanges` array — finds nothing — and falls through to showing the duplicate "Stage Changed / Stage Changed" text.

### Problem 3: `lead_activities` with `activity_type = 'stage_change'` duplicates from `lead_events`
Both `lead_activities` (from chatter sync) and `lead_events` (from CRM sync) create stage change entries. The UI merges both, resulting in duplicate stage change cards.

## Plan

### 1. DB: Actually create `odoo_message_id` on `lead_files`
Re-run the migration with `IF NOT EXISTS` safety. The previous migration file is there but never took effect.

### 2. Edge Function: Re-sync to populate `tracking_changes` and backfill file linkage
Update `odoo-chatter-sync` to:
- On re-sync (`full` mode), update existing activities that have `has_tracking: true` but missing `tracking_changes` in metadata
- Continue backfilling `lead_files.odoo_message_id` (which will now work since the column exists)

### 3. UI: Deduplicate stage changes and fix fallback text
In `OdooChatter.tsx`:
- When merging `eventActivities` into the thread, skip `lead_events` stage changes if a matching `lead_activities` entry with `activity_type = 'stage_change'` exists for the same lead around the same timestamp
- For stage changes with `has_tracking: true` but no `tracking_changes` array, show just the author name and arrow icon (no "Stage Changed / Stage Changed" double text)
- Keep the current tracking bullet rendering for activities that DO have `tracking_changes`

### 4. Trigger re-sync
After deploying, the user runs "Sync Odoo" to backfill both tracking data and file linkage.

| File | Change |
|------|--------|
| DB migration | `ALTER TABLE lead_files ADD COLUMN IF NOT EXISTS odoo_message_id integer` + index |
| `supabase/functions/odoo-chatter-sync/index.ts` | Update existing activities missing `tracking_changes`, backfill file linkage |
| `src/components/pipeline/OdooChatter.tsx` | Deduplicate stage changes, fix "Stage Changed" fallback display |

