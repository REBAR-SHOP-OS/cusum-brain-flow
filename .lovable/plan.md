

# Inline File Preview on Click

## Problem
Clicking a file in the timeline (InlineFileLink) opens it in a new browser tab. The user wants an inline preview within the same page.

## Solution
Add an `onClick` handler to the file card that opens a modal/dialog overlay showing the file preview. Support:
- **PDFs**: render in an `<iframe>` 
- **Images** (jpg, png, etc.): render in an `<img>` tag
- **Other files** (DWG, XLS, etc.): show a message "Preview not available" with download button

## Changes

### `src/components/pipeline/InlineFileLink.tsx`

1. Add state `previewOpen` to toggle a preview dialog
2. Make the file name/icon area clickable to open preview
3. Add a `Dialog` overlay that renders:
   - For images: `<img>` full-size preview
   - For PDFs: `<iframe src={url}>` embedded viewer
   - For others: fallback message + download button
4. Keep existing Download and Copy buttons unchanged

```tsx
// Pseudocode for the preview logic
const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(name);
const isPdf = /\.pdf(\?|$)/i.test(name);

<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
  <DialogContent className="max-w-4xl max-h-[90vh]">
    {isImage && <img src={url} className="max-w-full max-h-[80vh] object-contain" />}
    {isPdf && <iframe src={url} className="w-full h-[80vh]" />}
    {!isImage && !isPdf && <p>Preview not available. <a>Download</a></p>}
  </DialogContent>
</Dialog>
```

## Files Changed
- `src/components/pipeline/InlineFileLink.tsx` — add Dialog-based inline preview

All consumers (LeadTimeline, OdooChatter, SalesLeadChatter, DockChatBox) will automatically get the preview behavior since they use the same component.

