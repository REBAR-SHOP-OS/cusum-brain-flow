

## Plan: Fix Image/Video Display in Team Hub MessageThread

### Problem
In Team Hub's `MessageThread`, when a user sends an image or video, the message shows raw markdown text like `📎 [LOGO.png](url)` instead of rendering the image inline. The floating chat (`DockChatBox`) already handles this correctly using `parseAttachmentLinks()` — but `MessageThread` does not.

### Root Cause
`MessageThread.tsx` line 461 renders `displayText` as plain text inside a `<p>` tag without parsing embedded attachment links. The `DockChatBox` already uses `parseAttachmentLinks()` from `chatFileUtils.ts` to extract and render these inline.

### Fix

**File: `src/components/teamhub/MessageThread.tsx`** (~lines 452-502)

1. Import `parseAttachmentLinks` and `isImageUrl` from `chatFileUtils.ts` (already imports `fixChatFileUrl`).
2. In the message body section, call `parseAttachmentLinks(displayText)` to extract embedded `📎 [name](url)` links.
3. Merge parsed attachments with existing `msg.attachments` array.
4. Render `cleanText` instead of raw `displayText`.
5. For parsed attachments, detect images by URL extension (using `isImageUrl`) and render `<img>` with download button; for videos (`.mp4`), render `<video>` with controls and download; for other files, render the existing file download button.

### Code Changes

```typescript
// Inside the message body render block (~line 453):
const { cleanText, parsedAttachments } = parseAttachmentLinks(displayText);
const allAttachments = [
  ...attachments.map(a => ({ name: a.name, url: fixChatFileUrl(a.url), type: a.type })),
  ...parsedAttachments.map(a => ({ name: a.name, url: a.url, type: "" })),
];

// Render cleanText instead of displayText in the <p> tag
// Render allAttachments with image/video/file detection
```

For video detection, add a helper:
```typescript
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}
```

Video attachments render as:
```tsx
<video src={url} controls className="rounded-lg border max-w-[320px]" preload="metadata" />
<button onClick={download}>Download</button>
```

Single file change. No backend or database changes needed.

