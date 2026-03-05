

## Root Cause Analysis (confirmed from production data)

**Problem 1 — No email bodies/signatures/images**: The `body_html` column on `lead_activities` is NULL for all 39,603 rows. However, the HTML IS stored inside `metadata.body_html` (as a JSON field from the original sync). The UI reads `(activity as any).body_html` (the column), which is always null. It never falls back to `metadata.body_html`.

**Problem 2 — No tracking details (New → Estimation-Ben)**: The metadata has `"has_tracking": true` but no `tracking_changes` array. The original sync set the flag but never fetched `mail.tracking.value` data from Odoo. The full sync backfill would fix this, but it hasn't been run yet.

**Problem 3 — No files/attachments visible**: All 15,745 `lead_files` have `odoo_message_id = NULL`. We hid unlinked Odoo files in the last edit, so now nothing shows. The backfill hasn't run because the user hasn't clicked "Sync Odoo" with the new full-mode code yet.

**Problem 4 — Duplicate "Stage Changed"**: The collapse logic IS working (3 entries → 1 shown). The user's screenshot confirms only 1 "Stage Changed" card. The remaining issue is it says "Stage Changed" without showing "New → Estimation-Ben" because tracking data is missing.

## Fix Plan (immediate, no sync required)

### 1. Read `body_html` from metadata fallback (`OdooChatter.tsx`)
In `ActivityThreadItem`, change:
```typescript
const bodyHtml = (activity as any).body_html as string | null;
```
to:
```typescript
const bodyHtml = (activity as any).body_html || metadata.body_html || null;
```
This immediately surfaces all email bodies, signatures, and inline images for the 39,603 existing rows.

### 2. Show unlinked Odoo files again (`OdooChatter.tsx`)
Revert the "hide unlinked Odoo files" change. Push `unlinkedOdooFiles` back into the thread as `file_group` items. Since the full sync hasn't run yet, hiding them means hiding ALL Odoo files. Show them until linkage works.

### 3. Stage change description fallback
For stage_change activities where `metadata.has_tracking === true` but no `tracking_changes` array, parse the `description` field if it contains arrow notation (e.g., "New → Estimation-Ben") and display it. Otherwise show the generic "Stage Changed" (which is already happening).

## Files to change
- `src/components/pipeline/OdooChatter.tsx` (3 targeted edits)

No database changes needed. No edge function changes. These fixes work with existing data immediately.

