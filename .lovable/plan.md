
# Fix: Screenshot Captures Only Visible Viewport — Content Truncated

## Root Cause

**File:** `src/components/feedback/ScreenshotFeedbackButton.tsx`

The `capture()` function computes dimensions using `getBoundingClientRect()`:

```ts
const rect = target.getBoundingClientRect();
// ...
width: rect.width,
height: rect.height,
x: rect.left,
y: rect.top,
```

`getBoundingClientRect()` returns only the **visible** bounding box of the element on screen — not its full scrollable content. So if `#main-content` is 900px tall on screen but contains 2400px of scrollable content, the canvas is only told to be 900px tall. Everything below/to the right of the scroll position is clipped.

## The Fix — One File Only: `src/components/feedback/ScreenshotFeedbackButton.tsx`

Replace the `rect`-based width/height/x/y with the element's **full scroll dimensions** (`scrollWidth`, `scrollHeight`, `scrollLeft`, `scrollTop`). This tells `html2canvas` to render the complete document, not just what's currently visible.

### For the `hasOverlay` branch (dialog/drawer open):
No change needed — dialogs always use `window.innerWidth/Height` which is correct for modal capture.

### For the normal (non-overlay) branch — the broken path:

**Before:**
```ts
const rect = hasOverlay
  ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  : target.getBoundingClientRect();

const baseOpts = {
  width: rect.width,
  height: rect.height,
  x: rect.left,
  y: rect.top,
  scrollX: 0,
  scrollY: 0,
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight,
  ...
};
```

**After:**
```ts
// For overlay path: use viewport dimensions (unchanged)
// For normal path: use the full scroll dimensions of the target element
const isOverlay = !!hasOverlay;

const captureWidth  = isOverlay ? window.innerWidth  : target.scrollWidth;
const captureHeight = isOverlay ? window.innerHeight : target.scrollHeight;
const captureX      = isOverlay ? 0 : target.getBoundingClientRect().left + target.scrollLeft;
const captureY      = isOverlay ? 0 : target.getBoundingClientRect().top  + target.scrollTop;

const baseOpts = {
  width:        captureWidth,
  height:       captureHeight,
  windowWidth:  Math.max(window.innerWidth,  captureWidth),
  windowHeight: Math.max(window.innerHeight, captureHeight),
  x:            captureX,
  y:            captureY,
  scrollX:      -target.scrollLeft,
  scrollY:      -target.scrollTop,
  ...
};
```

**Key details:**
- `scrollWidth` / `scrollHeight` — the **full** content dimensions including off-screen content.
- `scrollX: -target.scrollLeft` / `scrollY: -target.scrollTop` — tells html2canvas to offset the canvas origin to include content scrolled above/to the left of the current viewport.
- `windowWidth/windowHeight` clamped to at least the capture size — prevents html2canvas from clipping the canvas to the window boundary.

## Scope

| File | Lines | Change |
|---|---|---|
| `src/components/feedback/ScreenshotFeedbackButton.tsx` | 37–53 | Replace `getBoundingClientRect`-based dimensions with `scrollWidth`/`scrollHeight`-based dimensions |

## What Is NOT Changed
- `AnnotationOverlay.tsx` — untouched
- Dialog/overlay capture path — logic preserved, only the non-overlay path is corrected
- All other components, pages, database, edge functions — untouched
