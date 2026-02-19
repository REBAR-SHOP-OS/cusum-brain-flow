
# Add Drag-and-Drop & Ctrl+V Paste to ChatInput

## What's Being Added

Two file input methods will be added to the existing `ChatInput` component (`src/components/chat/ChatInput.tsx`):

1. **Drag & Drop** — Users can drag files from their desktop and drop them anywhere on the chat input area
2. **Ctrl+V / Paste** — Users can paste images or files directly from their clipboard into the chat

Since `ChatInput` is shared across all agent workspaces (including Pixel/social, Gauge, Relay, etc.), this works for all agents automatically with no changes needed in pages.

---

## Technical Details

### Changes — `src/components/chat/ChatInput.tsx` only

**1. Add `isDragOver` state**
```ts
const [isDragOver, setIsDragOver] = useState(false);
```

**2. Add drag event handlers**
```ts
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(true);
};
const handleDragLeave = () => setIsDragOver(false);
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(false);
  if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
};
```

**3. Extract file processing into shared `processFiles` function**

The existing upload logic inside `handleFileSelect` will be refactored into a `processFiles(files: FileList)` function. Both the file `<input onChange>` and the new drag/paste handlers call this shared function — no logic duplication.

**4. Add paste handler on the textarea**
```ts
const handlePaste = (e: React.ClipboardEvent) => {
  const files = e.clipboardData?.files;
  if (files?.length) {
    e.preventDefault();
    processFiles(files);
  }
  // If no files in clipboard, normal text paste proceeds naturally
};
```

**5. Apply drag visual feedback & event handlers to the outer container**

The outer wrapper `div` gets the drag handlers and a conditional ring highlight:
```tsx
<div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={cn(
    "relative bg-secondary rounded-xl border border-border/50 shadow-sm ...",
    isDragOver && "ring-2 ring-primary border-primary bg-primary/5"
  )}
>
```

**6. Drop overlay text** — When dragging over, an overlay label appears inside the box:
```tsx
{isDragOver && (
  <div className="absolute inset-0 bg-primary/10 rounded-xl flex items-center justify-center pointer-events-none z-10">
    <p className="text-sm font-semibold text-primary">Drop files here</p>
  </div>
)}
```

**7. Add `onPaste` to the textarea**
```tsx
<textarea ... onPaste={handlePaste} />
```

---

## Scope

| File | Change |
|---|---|
| `src/components/chat/ChatInput.tsx` | Add drag-and-drop + paste handlers, extract `processFiles`, visual feedback |

No other files need changes — all agent pages (`AgentWorkspace.tsx`, `Inbox.tsx`, `Home.tsx`) already use `ChatInput` and will inherit the feature automatically.

The `showFileUpload` prop still gates whether the paperclip button is shown, but drag-and-drop and paste will work **regardless** of `showFileUpload` so users always have a convenient way to attach files.
