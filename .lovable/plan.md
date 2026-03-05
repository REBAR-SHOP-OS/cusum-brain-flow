

# Fix Files Placement — Link Files to Their Parent Odoo Message

## Root Cause

The "puzzle" is this: every Odoo attachment (`ir.attachment`) belongs to a specific `mail.message`. The chatter sync already stores `odoo_message_id` on `lead_activities`. The `lead_files` table has `odoo_id` (the attachment's Odoo ID). But there's **no column linking a file to its parent message**.

The Odoo `mail.message` API returns an `attachment_ids` field — an array of attachment IDs belonging to that message. We never fetch it, so we can't connect the dots.

## Plan

### 1. DB Migration: Add `odoo_message_id` to `lead_files`

```sql
ALTER TABLE public.lead_files ADD COLUMN odoo_message_id integer;
CREATE INDEX idx_lead_files_odoo_message_id ON public.lead_files (odoo_message_id);
```

### 2. Sync Fix: Fetch `attachment_ids` and backfill `lead_files.odoo_message_id`

In `supabase/functions/odoo-chatter-sync/index.ts`:
- Add `"attachment_ids"` to the `fields` list in the `mail.message` search_read call (line 177)
- After inserting/updating activities, loop through messages that have `attachment_ids` and update matching `lead_files` rows:
  ```sql
  UPDATE lead_files SET odoo_message_id = <msg.id> WHERE odoo_id = ANY(<msg.attachment_ids>)
  ```

### 3. UI: Match files to activities by `odoo_message_id` instead of timestamp

In `src/components/pipeline/OdooChatter.tsx`:
- In the `thread` memo, build a `Map<number, any[]>` from `odoo_message_id → files[]` using `lead_files` data
- For each activity with `odoo_message_id`, attach its matched files
- Pass matched files to `ActivityThreadItem` and render them inline via `InlineFileAttachments`
- Only files with NO `odoo_message_id` (locally uploaded or unlinked) remain as standalone `file_group` entries
- Remove the 60s batching for matched files — they go under their parent message

### 4. Quick backfill for existing data

Add a small section at the end of the chatter sync that retroactively links existing `lead_files` to their messages:
```ts
// After message sync, backfill file linkage
for (const msg of allFetchedMessages) {
  if (msg.attachment_ids?.length) {
    await serviceClient.from("lead_files")
      .update({ odoo_message_id: msg.id })
      .in("odoo_id", msg.attachment_ids);
  }
}
```

| File | Change |
|------|--------|
| DB migration | Add `odoo_message_id` column + index to `lead_files` |
| `supabase/functions/odoo-chatter-sync/index.ts` | Fetch `attachment_ids`, backfill `lead_files.odoo_message_id` |
| `src/components/pipeline/OdooChatter.tsx` | Match files to activities by `odoo_message_id`, render inline under parent message |

After deploying, re-running "Sync Odoo" will backfill the linkage for all existing files. Files will then appear exactly where they belong — under their parent message, just like Odoo.

