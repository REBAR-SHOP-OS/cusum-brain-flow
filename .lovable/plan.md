

# Fix Attachment Button in Email Composer

## Problem
The Paperclip (attachment) button in `ComposeEmailDialog.tsx` (line 392-394) is a dummy button with no `onClick` handler. Additionally, the `gmail-send` Edge Function uses a simple `text/html` content type and does not support MIME multipart messages with attachments.

## Solution — Two-part fix

### 1. Add file selection and state to `ComposeEmailDialog.tsx`

- Add a hidden `<input type="file" multiple>` ref
- Wire the Paperclip button's `onClick` to trigger the file input
- Store selected files in state as `{ file: File; name: string; size: number }[]`
- Show attached files as removable chips below the body textarea
- Convert files to base64 before sending and include in the `gmail-send` body as an `attachments` array
- Limit: max 5 files, max 10MB each

### 2. Update `gmail-send` Edge Function to support MIME multipart

- Update the `createRawEmail` function to generate a `multipart/mixed` MIME message when attachments are present
- Each attachment encoded as a base64 MIME part with proper `Content-Disposition: attachment` headers
- Update the Zod schema to accept an optional `attachments` array: `{ filename: string; contentType: string; base64: string }[]`
- When no attachments, keep the current simple `text/html` format (backward compatible)

## Technical Details

```text
ComposeEmailDialog.tsx changes:
├── Add: fileInputRef, attachments state
├── Wire: Paperclip onClick → fileInputRef.click()
├── Display: attachment chips with X to remove
├── Convert: files to base64 on send
└── Pass: attachments array to gmail-send

gmail-send/index.ts changes:
├── Update Zod schema: add optional attachments[]
├── Update createRawEmail: multipart/mixed when attachments present
│   ├── boundary-based MIME structure
│   ├── text/html part for body
│   └── base64 parts for each attachment
└── Backward compatible: no attachments = same behavior
```

## Files Changed
- `src/components/inbox/ComposeEmailDialog.tsx` — add file input, state, UI chips, base64 conversion
- `supabase/functions/gmail-send/index.ts` — support multipart MIME attachments

