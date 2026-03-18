

## Plan: Full Email with Attachments Support

### Problem
The gmail-sync edge function already extracts attachment metadata (filename, mimeType, size, attachmentId) and stores it in `communications.metadata.attachments`. However:
1. The `InboxEmail` interface has no `attachments` field
2. The mapping in `InboxView.tsx` doesn't pass attachments through
3. `InboxEmailViewer.tsx` only extracts attachments by regex-parsing the HTML body — it misses actual Gmail attachments (PDFs, images, etc.) that aren't inline links
4. There's no way to download actual Gmail attachments (which require a separate API call to `gmail/v1/.../attachments/{id}`)

### Solution

#### 1. New edge function: `gmail-attachment` 
Create a small edge function that fetches a single attachment by messageId + attachmentId from the Gmail API and returns the base64 data. This is needed because Gmail attachments aren't URLs — they require an authenticated API call.

#### 2. Update `InboxEmail` interface (`InboxEmailList.tsx`)
Add `attachments?: { filename: string; mimeType: string; size: number; attachmentId: string }[]`

#### 3. Update mapping in `InboxView.tsx`
Pass `metadata.attachments` through to the `InboxEmail` object.

#### 4. Update `InboxEmailViewer.tsx`
- Merge regex-extracted attachments with real Gmail attachments from metadata
- For real Gmail attachments: render with proper icons, file size, and a download button that calls the `gmail-attachment` edge function, receives base64 data, and triggers a browser download
- For image attachments: render inline preview with download option
- For video attachments: render `<video>` player with download option

### Files Changed
- `supabase/functions/gmail-attachment/index.ts` — New edge function to fetch attachment data
- `src/components/inbox/InboxEmailList.tsx` — Add attachments to interface
- `src/components/inbox/InboxView.tsx` — Pass attachments from metadata
- `src/components/inbox/InboxEmailViewer.tsx` — Render real attachments with download support

