
Goal: stop duplicate stage cards and restore Odoo image/file visibility in chatter (with parity-safe behavior).

What’s actually broken right now (confirmed):
1) `lead_files.odoo_message_id` is still missing in production (`has_col = false`), so file→message linkage cannot happen.
2) UI currently hides unlinked Odoo files (`source=odoo_sync`) as orphans, so users see “no pictures/files.”
3) Non-image Odoo attachments cannot be opened even when rendered, because download logic only handles `storage_path` / `file_url`, not `odoo_id`.
4) Legacy stage-change rows are noisy (`title/description = "Stage Changed"`, no tracking details), so same-minute duplicates are still visible.

Implementation plan:

1) Hard-apply backend schema fix (not just commit SQL file)
- Execute migration through backend migration runner:
  - `ALTER TABLE public.lead_files ADD COLUMN IF NOT EXISTS odoo_message_id integer;`
  - `CREATE INDEX IF NOT EXISTS idx_lead_files_odoo_message_id ON public.lead_files(odoo_message_id);`
- Verify immediately with `information_schema.columns` query that column exists.

2) Strengthen `odoo-chatter-sync` data repair path
- Keep preflight check (good), but make full sync return explicit counters:
  - `files_linked`, `messages_with_attachments`, `files_unlinked_remaining`.
- In full mode, always update existing `lead_activities` metadata for known `odoo_message_id` rows (not only when `body_html` exists), so legacy rows can receive normalized metadata/tracking.
- Keep attachment linkage backfill (`lead_files.odoo_message_id = msg.id` by `odoo_id in attachment_ids`) for all leads.

3) Fix chatter rendering so users can see files immediately
- In `OdooChatter.tsx`, change orphan logic:
  - If linkage is available, render inline under parent message as now.
  - If a file is Odoo-origin but still unlinked, do NOT fully hide it; show in a fallback “Unlinked Odoo attachments” group until backfill completes.
- This prevents blank “no files” states while sync catches up.

4) Add proper Odoo non-image download support
- In `InlineFileAttachments` non-image button handler:
  - Add `else if (file.odoo_id)` branch.
  - Fetch blob via authenticated `odoo-file-proxy?id=<odoo_id>` and open/download blob URL.
- This fixes “files visible but not opening” for PDFs/docs/txt from Odoo.

5) Remove duplicate stage-noise in UI (safe collapse)
- In thread builder, add client-side collapse for legacy stage-change noise:
  - collapse consecutive `stage_change` items when same lead context + same author + same minute + same generic text (“Stage Changed”) + no tracking/body_html.
- Keep real tracked stage changes untouched.
- Keep existing `lead_events` stage dedupe.

Validation checklist (must pass):
1) DB check: `lead_files.odoo_message_id` exists in production.
2) Full sync response shows non-zero `files_linked` for affected leads.
3) Lead `S02728, FW: 3 Kingsbury Crescent`: images render in chatter and docs are downloadable.
4) No top detached “7 files attached” block when linkage exists; fallback group appears only for genuinely unlinked Odoo files.
5) Same-minute generic “Stage Changed” spam collapses to a single visible entry.

Files to update:
- `supabase/migrations/<new_timestamp>_add_odoo_message_id_safe.sql` (and execute migration)
- `supabase/functions/odoo-chatter-sync/index.ts`
- `src/components/pipeline/OdooChatter.tsx`

Technical notes:
- No auth/RLS policy changes required for this fix.
- Keep all changes scoped to chatter sync + chatter rendering only.
- Avoid editing auto-generated integration files.
