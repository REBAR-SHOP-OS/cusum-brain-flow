

# Improve Task Detail Dialog UI -- Readability, Copy, Full Screen

## Scope
Only the Task Detail Dialog in `src/pages/Tasks.tsx` (lines 311-395). No other files, pages, database, or logic changes.

## Changes

### 1. Wider Dialog
- Change `max-w-lg` to `max-w-2xl` on `DialogContent` (line 313)
- This gives ~50% screen width on desktop

### 2. Description Container -- Readable and Scrollable
Replace the plain `<p>` description (lines 322-327) with a styled container:
- `whitespace-pre-wrap` to preserve line breaks
- `break-words` for long URLs
- `overflow-y: auto` with `max-h-[calc(100vh-320px)]` for vertical scroll
- Font size `text-[15px]`, `leading-relaxed` (line-height ~1.6)
- Better contrast: `text-foreground` instead of default
- Auto-detect URLs and make them clickable links
- Auto-detect code blocks (backtick-wrapped) and render in monospace

### 3. Copy Button
- Add a "Copy" button (clipboard icon) next to the "Description" label
- On click: `navigator.clipboard.writeText(description)` with fallback to `document.execCommand("copy")`
- Show toast "Copied!" on success
- Icon changes briefly to a checkmark after copying

### 4. Full Screen / Expand Button
- Add an "Expand" button (Maximize2 icon) next to Copy
- Opens a new Dialog (modal) that is full-screen (`max-w-[90vw] max-h-[90vh]`)
- Shows the full description text with same styling
- Close with X button or ESC key
- Pure UI, no data changes

### 5. New Imports
Add to existing imports: `Copy, Check, Maximize2` from lucide-react

## Technical Detail

All changes are in `src/pages/Tasks.tsx`:

**Line 2**: Add `Copy, Check, Maximize2` to lucide imports

**Line 3-4**: Add `toast` from `sonner` import (for lightweight "Copied" toast)

**Line 97**: Add state: `const [fullScreenOpen, setFullScreenOpen] = useState(false);` and `const [copied, setCopied] = useState(false);`

**Add helper function** `copyToClipboard(text)`:
```text
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast("Copied!");
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("Copied!");
  }
}
```

**Add helper function** `linkifyText(text)` to auto-detect URLs and render as clickable `<a>` tags.

**Line 313**: `max-w-lg` becomes `max-w-2xl`

**Lines 322-327**: Replace description block with:
```text
<div>
  <div className="flex items-center justify-between mb-1">
    <span className="text-muted-foreground font-medium">Description</span>
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => copyToClipboard(selectedTask.description)}>
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => setFullScreenOpen(true)}>
        <Maximize2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  </div>
  <div className="mt-1 text-[15px] leading-relaxed text-foreground
    whitespace-pre-wrap break-words overflow-y-auto
    max-h-[calc(100vh-320px)] rounded-md border border-border/50
    bg-muted/30 p-3">
    {linkifyText(selectedTask.description)}
  </div>
</div>
```

**After the main Dialog (after line 395)**: Add Full Screen Dialog:
```text
<Dialog open={fullScreenOpen} onOpenChange={setFullScreenOpen}>
  <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
    <DialogHeader>
      <DialogTitle>{selectedTask?.title}</DialogTitle>
    </DialogHeader>
    <div className="flex-1 overflow-y-auto text-[15px] leading-relaxed
      text-foreground whitespace-pre-wrap break-words p-4">
      {selectedTask?.description && linkifyText(selectedTask.description)}
    </div>
  </DialogContent>
</Dialog>
```

## What Does NOT Change
- Task list UI
- Database queries or schema
- Task status logic
- Any other page or component
- Filters, header, or navigation
