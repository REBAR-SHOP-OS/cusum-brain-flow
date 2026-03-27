

# Fix File Download in Chat Messages

## Problem
Chat file attachments use signed URLs (1-hour expiry) stored at upload time. When users try to download later, the URL has expired and the download fails.

## Root Cause
In `ChatMessage.tsx` (line 73-83) and `CalChatMessage.tsx` (line 60-70), file links use `file.url` directly as an `<a href>`. This URL is a signed URL generated at upload time with a 1-hour TTL. After expiry, clicking does nothing useful.

## Solution
Replace the static `<a>` tag with a click handler that generates a fresh signed URL on demand using `file.path`, then triggers the download via `downloadFile()` utility.

### Changes

**`src/components/chat/ChatMessage.tsx` (~lines 70-84)**
- Replace `<a href={file.url}>` with a `<button>` or `<div>` that calls an async handler
- Handler: call `getSignedFileUrl(file.path)` to get a fresh URL, then call `downloadFile(freshUrl, file.name)`
- Show a brief loading state on the download icon while fetching the signed URL
- Import `getSignedFileUrl` from `@/lib/storageUtils` and `downloadFile` from `@/lib/downloadUtils`

**`src/components/chat/CalChatMessage.tsx` (~lines 58-70)**
- Apply the same pattern: replace `<a>` with click handler that refreshes the signed URL before downloading

### Key Logic
```tsx
const handleFileDownload = async (file: UploadedFile) => {
  const freshUrl = await getSignedFileUrl(file.path);
  if (!freshUrl) {
    toast.error("Failed to get download link");
    return;
  }
  downloadFile(freshUrl, file.name);
};
```

## Files changed
- `src/components/chat/ChatMessage.tsx` — fresh signed URL on click
- `src/components/chat/CalChatMessage.tsx` — same fix

