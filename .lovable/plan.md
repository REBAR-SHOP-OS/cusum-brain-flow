

# Fix Missing Files and Images in Chatter

## Root Causes Found

**Bug 1: Unlinked Odoo files are silently dropped.**
In `OdooChatter.tsx` line 349-460, files from Odoo that lack an `odoo_message_id` are pushed into `unlinkedOdooFiles` — but that array is **never rendered**. Only `orphanFiles` (non-Odoo uploads) get pushed to `pushFileBatches`. So any Odoo file that wasn't successfully linked to a message during chatter sync simply vanishes from the UI.

**Bug 2: Email body images from Odoo don't load.**
Odoo emails contain `<img src="https://odoo.rebar.shop/web/image/...">` tags. These require Odoo authentication to fetch. DOMPurify correctly allows `<img>` tags, but the browser can't load them because there's no auth cookie/header. Result: broken image placeholders in email bodies (the signature logo, inline screenshots, etc.).

## Fix

### 1. Render unlinked Odoo files (OdooChatter.tsx)

Change line 460 from only pushing `orphanFiles` to also pushing `unlinkedOdooFiles`:

```
pushFileBatches(orphanFiles);
pushFileBatches(unlinkedOdooFiles);  // ← ADD THIS
```

This immediately makes all Odoo-synced files (PDFs, images) visible in the chatter timeline, even if they couldn't be matched to a specific message.

### 2. Proxy Odoo images in email HTML bodies (OdooChatter.tsx)

After DOMPurify sanitizes the HTML, post-process it to replace Odoo image URLs with proxied URLs:

- Detect `<img src="...odoo...">` patterns in the sanitized HTML
- Replace with `src="${VITE_SUPABASE_URL}/functions/v1/odoo-file-proxy?url=..."` (passing the original URL as a query param)
- The existing `odoo-file-proxy` edge function already handles authenticated fetching from Odoo

This requires a small update to `odoo-file-proxy` to accept a `url` query parameter (currently it only accepts `id`). Add a branch that fetches by direct URL when `url` is provided.

### 3. Update odoo-file-proxy to support URL-based fetching

Add logic: if `?url=<odoo-url>` is provided instead of `?id=`, fetch that URL directly using the stored Odoo credentials, and stream the response back. This handles inline email images without needing to know the attachment ID.

## Files to change

| File | Change |
|------|--------|
| `src/components/pipeline/OdooChatter.tsx` | Push `unlinkedOdooFiles` to file batches; post-process sanitized HTML to proxy Odoo image URLs |
| `supabase/functions/odoo-file-proxy/index.ts` | Accept `?url=` param for proxying arbitrary Odoo image URLs |

