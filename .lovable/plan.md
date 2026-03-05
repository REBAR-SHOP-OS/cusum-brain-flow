
Goal: make chatter match Odoo exactly and stop showing detached “files attached” cards.

What is still wrong (confirmed from code + database):
1) `lead_files.odoo_message_id` is still missing in production, so file-to-message linking cannot work.
2) `OdooChatter.tsx` still renders unlinked Odoo files as standalone `file_group` items, which creates the wrong top “7 files attached” block.
3) Stage tracking data is still empty (`tracking_changes` not populated), so some stage entries still degrade to generic text.

Implementation plan (single pass, no guesswork):

1) Hard-fix schema with safe migration
- Add a new migration (fresh timestamp) with:
  - `ALTER TABLE public.lead_files ADD COLUMN IF NOT EXISTS odoo_message_id integer;`
  - `CREATE INDEX IF NOT EXISTS idx_lead_files_odoo_message_id ON public.lead_files(odoo_message_id);`
- Do not rely on old migration file; this one must be idempotent.

2) Make `odoo-chatter-sync` fail fast if schema is broken
- Add startup preflight in `supabase/functions/odoo-chatter-sync/index.ts`:
  - Query `information_schema.columns` for `lead_files.odoo_message_id`.
  - If missing, return explicit error (not silent warning path).
- This prevents “looks successful but not linked” runs.

3) Backfill file linkage for all leads (approved scope)
- Keep `attachment_ids` in `mail.message` fetch.
- Build message→attachment mapping and update `lead_files` by `odoo_id` in batches.
- Track and return counts: `files_linked`, `files_unlinked_remaining`, `messages_with_attachments`.
- Keep this in full sync mode so one “Sync Odoo (full)” repairs existing history.

4) Enforce strict Odoo parity in UI
- In `src/components/pipeline/OdooChatter.tsx` thread builder:
  - Keep inline render for files matched by `odoo_message_id`.
  - For standalone orphan rendering, exclude Odoo-origin files:
    - only show standalone files when `source !== 'odoo_sync'` (e.g., local chatter uploads).
  - Result: no detached Odoo “files attached” card at top, even if partial linkage remains.

5) Stage-change cleanup (same pass)
- Keep current duplicate suppression between `lead_activities` and `lead_events`.
- Improve stage fallback rendering:
  - if `activity_type='stage_change'` and no `tracking_changes`, show only minimal line (author + arrow + from/to if available), never duplicate “Stage Changed” text blocks.

Validation checklist (must pass before done):
1) DB: `lead_files` has `odoo_message_id`.
2) Full sync result returns non-zero `files_linked` for affected leads.
3) For lead `S02728, FW: 3 Kingsbury Crescent`, Odoo files render under the parent message, not as top standalone group.
4) No detached Odoo file groups remain in chatter (only locally uploaded files can appear standalone).
5) Stage cards no longer show duplicated “Stage Changed / Stage Changed”.

Files to change:
- `supabase/migrations/<new_timestamp>_add_odoo_message_id_safe.sql`
- `supabase/functions/odoo-chatter-sync/index.ts`
- `src/components/pipeline/OdooChatter.tsx`
