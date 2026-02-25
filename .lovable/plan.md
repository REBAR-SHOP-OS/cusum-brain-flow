

## Fix: Crop Screenshot to Main Content (Remove Sidebar Bleed)

### Problem

The screenshot now captures full-page height correctly, but the left sidebar icons are bleeding into the captured image. The user wants the screenshot cropped tightly to just the main content area.

### Root Cause

When `html2canvas` is called with `target = #main-content`, the `x` and `y` crop coordinates are set to `targetRect.left` and `targetRect.top` — which includes the sidebar width (~64px) and topbar height. But `html2canvas` renders **relative to the target element**, so these offsets are wrong. Setting `x = 64` tells html2canvas to start 64px *into* the target, while the ancestor expansion with `overflow: visible` causes sibling elements (the sidebar) to bleed into the render.

### Fix

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`** — Lines 72-73

Change the capture origin to `(0, 0)` for non-overlay mode, since html2canvas already scopes rendering to the target element:

```typescript
// Before
const captureX = isOverlay ? 0 : (targetRect!.left + target.scrollLeft);
const captureY = isOverlay ? 0 : (targetRect!.top  + target.scrollTop);

// After
const captureX = 0;
const captureY = 0;
```

This removes the sidebar/topbar offset that was causing content outside `#main-content` to appear in the capture. Both overlay and non-overlay paths now use `(0, 0)` as origin.

### Files Changed
1. `src/components/feedback/ScreenshotFeedbackButton.tsx` — 2 lines changed

