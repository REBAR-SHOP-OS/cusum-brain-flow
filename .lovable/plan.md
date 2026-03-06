

# Fix: Download Button Not Actually Downloading Files

## Problem
The download icon (`<a download>`) doesn't trigger a file download because browsers ignore the `download` attribute on cross-origin URLs (Supabase storage URLs are on a different domain). Instead, clicking it just opens the image in a new tab.

## Solution
Create a shared `downloadFile` utility that uses `fetch` → `blob` → programmatic `<a>` click to force a real download. Then replace the `<a download>` links in both `DockChatBox.tsx` and `MessageThread.tsx` with `<button onClick={downloadFile}>`.

### Files Changed

1. **New**: `src/lib/downloadUtils.ts` — shared helper:
   - `async function downloadFile(url: string, filename: string)` 
   - Fetches the URL as a blob, creates a temporary object URL, triggers a programmatic click on a hidden `<a>` element with the `download` attribute (same-origin blob URL, so `download` works), then revokes the object URL.

2. **Edit**: `src/components/chat/DockChatBox.tsx` (lines 449-458)
   - Replace `<a href download>` with `<button onClick={() => downloadFile(att.url, att.name)}>` for image attachments
   - Same for non-image file attachments (lines 464-474)

3. **Edit**: `src/components/teamhub/MessageThread.tsx` (lines 476-486)
   - Replace `<a href download>` with `<button onClick={() => downloadFile(fixedUrl, att.name)}>` for image attachments
   - Same for non-image file attachments (lines 490-501)

