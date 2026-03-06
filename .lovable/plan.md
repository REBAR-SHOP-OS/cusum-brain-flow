

# Fix: Image Display, Download & Copy Icons in Floating Team Chat

## Root Cause

The DockChatBox (floating chat popup) has three problems:

1. **Images stored as expiring signed URLs**: Files are uploaded to the private `team-chat-files` bucket and a 7-day signed URL is stored in `original_text` and `attachments`. After 7 days, URLs expire and images break permanently.

2. **Images not rendered visually**: Both `DockChatBox.tsx` and `MessageThread.tsx` display file attachments as text links, not inline images. The `DockChatBox` doesn't even parse the markdown-style links in `original_text`.

3. **No download/copy actions**: No download icon under images, no copy icon under text messages.

## Fix Plan

### 1. Make the storage bucket public (Database Migration)

Change `team-chat-files` bucket from private to public so URLs never expire:

```sql
UPDATE storage.buckets SET public = true WHERE id = 'team-chat-files';
```

### 2. Switch uploads to use public URLs (2 files)

**`src/components/teamhub/MessageThread.tsx`** (lines 186-199) and **`src/components/chat/DockChatBox.tsx`** (lines 184-194):

Replace `createSignedUrl()` with `getPublicUrl()` after upload. This gives permanent, non-expiring URLs.

### 3. Add image rendering, download & copy icons to DockChatBox (1 file)

**`src/components/chat/DockChatBox.tsx`** (lines 408-424):

- Parse `original_text` for image URLs (markdown `![](url)` or `📎 [name](url)`) and attachment objects
- Render image attachments as `<img>` with a download button underneath
- Render text messages with a small copy icon underneath
- Add `Download` and `Copy` icons from lucide-react

### 4. Add image rendering + download/copy to MessageThread (1 file)

**`src/components/teamhub/MessageThread.tsx`** (lines 468-488):

- For image-type attachments, render inline `<img>` preview instead of just a link
- Add a download icon button under each image
- The copy icon already exists via `ContentActions` component (line 521), so text copy is already working in the full TeamHub view

### 5. Fix existing messages with expired signed URLs

Create a small utility that, when rendering a message, detects if an attachment URL contains `token=` (signed URL pattern) and regenerates a public URL by extracting the storage path from the URL.

## Files Changed
- `src/components/chat/DockChatBox.tsx` — image rendering + download/copy icons
- `src/components/teamhub/MessageThread.tsx` — inline image preview + download icon, public URL uploads
- Database migration — make `team-chat-files` bucket public

