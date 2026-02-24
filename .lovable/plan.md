

## Fix: Screenshot Annotation Modal Truncation

### Problem
The annotation overlay modal's canvas area grows beyond the available viewport height, pushing the description textarea and send button off-screen. The bottom of the annotated screenshot gets cut off.

### Root Cause
The `DialogContent` base component uses CSS `grid` layout, which conflicts with the `flex flex-col` applied by `AnnotationOverlay`. The canvas wrapper has `flex-1 overflow-auto`, but the canvas element itself (`w-full`) expands to its full intrinsic height without constraint, causing the flex container to overflow.

### Solution
**File: `src/components/feedback/AnnotationOverlay.tsx`**

1. **Add `overflow-hidden`** to the `DialogContent` className so the outer container clips properly within `95vh`.

2. **Constrain the canvas wrapper** -- change from `flex-1 overflow-auto` to `flex-1 min-h-0 overflow-auto`. The `min-h-0` is critical in flex layouts to allow the element to shrink below its content size, enabling the scroll behavior to work correctly.

### Technical Details

| Line | Current | Change |
|------|---------|--------|
| 315 | `className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col p-3 gap-2"` | Add `overflow-hidden` |
| 350 | `className="flex-1 overflow-auto border rounded-md bg-muted/30"` | Add `min-h-0` |

These are the only two class changes needed -- no structural or logic changes.
