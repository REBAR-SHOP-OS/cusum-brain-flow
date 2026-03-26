

# Add Ctrl+V Paste Support to Team Hub Chat

## Problem
The Team Hub `MessageThread.tsx` textarea does not have a paste handler. Users cannot paste images or files from clipboard into the chat — only the DockChatBox and CalChat have this feature.

## Solution
Add an `onPaste` handler to the `Textarea` in `MessageThread.tsx` that extracts files from `clipboardData` and processes them through a shared upload function (reusing the existing `handleFileUpload` logic).

## Changes

### `src/components/teamhub/MessageThread.tsx`

1. **Add a `processFiles` helper** (near line 365) that accepts a `FileList` and runs the same upload logic as `handleFileUpload` but without needing a change event:
```typescript
const processFiles = async (files: FileList) => {
  if (!files.length) return;
  setIsUploading(true);
  const newAttachments: ChatAttachment[] = [];
  const sessionOk = await ensureSession();
  if (!sessionOk) { setIsUploading(false); return; }
  for (const file of Array.from(files)) {
    // same upload logic as handleFileUpload
  }
  setPendingFiles(prev => [...prev, ...newAttachments]);
  setIsUploading(false);
};
```

2. **Add `onPaste` to the Textarea** (line 888, after `onKeyDown`):
```tsx
onPaste={(e) => {
  const files = e.clipboardData?.files;
  if (files?.length) {
    e.preventDefault();
    processFiles(files);
  }
}}
```

3. **Refactor `handleFileUpload`** to call `processFiles` internally so there's no code duplication.

## Files Changed
- `src/components/teamhub/MessageThread.tsx` — add paste handler + shared file processing function

