

# Fix Messy Chatter Feed — Clean Layout Matching Odoo

## Problems Identified

Looking at the Odoo screenshot vs our current implementation:

1. **Duplicate items**: Files from `lead_files` appear as separate thread items AND may also be referenced in `lead_activities` — doubling up entries
2. **No spacing between items**: `space-y-0` on the thread container — items bleed into each other
3. **HTML body truncated at 120px** — emails get cut off awkwardly instead of showing full content like Odoo
4. **File attachments not grouped** — each file is a separate thread entry instead of being grouped under the activity/message that attached them
5. **Missing visual structure** — Odoo shows clear card-like separation per message with borders, our feed is flat

## Changes

### `src/components/pipeline/OdooChatter.tsx`

**1. Deduplicate files from thread**
- Files that have a matching `odoo_id` in an activity's context should not appear as separate `FileThreadItem` entries
- Filter out `lead_files` whose `created_at` is within 2 seconds of an activity's `created_at` for the same lead (they're the same Odoo message)
- OR simpler: remove `files` from the unified thread entirely — show files ONLY as inline attachments within their parent activity. Query `lead_files` per activity based on timestamp proximity or `odoo_message_id`.

**2. Fix spacing** 
- Change thread container from `space-y-0` to `space-y-1` and add subtle dividers between items (matching Odoo's card separation)

**3. Improve HTML rendering**
- Remove `max-h-[120px]` default — show full email body by default (Odoo does this)
- Keep "Show less" toggle for very long emails (>500px rendered) but expand by default
- Add a subtle border/card wrapper around email bodies like Odoo

**4. Group file attachments under their parent message**
- For `FileThreadItem`, group consecutive files uploaded at similar times into a single entry with multiple file chips (matching Odoo's "File attached" with multiple images shown together)

**5. Better visual separation**
- Add `border-b border-border` between thread items instead of relying on spacing alone
- Give each thread item slightly more padding

| File | Change |
|------|--------|
| `src/components/pipeline/OdooChatter.tsx` | Deduplicate files, fix spacing, expand HTML by default, group file attachments, add visual dividers |

