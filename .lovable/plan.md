

# Chatter Data Loss Fix — Store & Render Full Odoo HTML

## Problem

The `odoo-chatter-sync` function calls `stripHtml()` on every email body before storing it in `lead_activities.description`. This permanently destroys:

- Full HTML email content (signatures, formatted text, links, invitation-to-bid documents)
- Inline images and logos
- Detailed field-change tracking (Odoo shows bullet points like "• Name → MAYSTAR GENERAL... (Customer)")

The Odoo screenshot shows rich email threads with From/Sent/To/Subject headers and full HTML bodies rendered inline. Our chatter shows only plain text summaries.

## Root Cause

```javascript
// odoo-chatter-sync/index.ts line ~189
description: body || null,  // body = stripHtml(msg.body) — HTML is GONE
```

The `metadata` JSON column exists but only stores `odoo_subtype`. The original HTML is never saved.

## Plan

### Step 1: Add `body_html` column to `lead_activities`

```sql
ALTER TABLE lead_activities ADD COLUMN body_html text;
```

### Step 2: Update `odoo-chatter-sync` to preserve HTML

- Store original `msg.body` (raw HTML) in `body_html`
- Keep stripped text in `description` (for search/preview)
- Fetch `tracking_value_ids` from Odoo `mail.message` to capture field changes
- Store tracking values in `metadata.tracking_changes` as an array of `{ field, old_value, new_value }`

### Step 3: Update `OdooChatter.tsx` to render HTML

- When `body_html` exists, render it using DOMPurify (already installed) instead of plain text
- Show From/To/Subject headers above email bodies (from metadata or parsed from HTML)
- Render field changes as colored bullet points matching Odoo: `• Field → New Value (Label)`
- Use `dangerouslySetInnerHTML` with sanitized HTML inside a styled container

### Step 4: Re-sync to backfill HTML

After deploying the updated sync function, run a `full` mode sync to re-fetch all messages with HTML bodies. Existing `odoo_message_id` dedup will be bypassed for rows that have `body_html IS NULL`.

| File | Change |
|------|--------|
| Database migration | Add `body_html text` column |
| `supabase/functions/odoo-chatter-sync/index.ts` | Store raw HTML in `body_html`, fetch `tracking_value_ids` |
| `src/components/pipeline/OdooChatter.tsx` | Render HTML with DOMPurify, show field changes as bullet list |

