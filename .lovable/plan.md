

# Fix: Screenshot Button - Speed and Reliability Improvements

## Problem
The camera button for screenshots is slow and unreliable, especially on complex pages like the CRM Pipeline. The main causes are:

1. **Dynamic import of html2canvas** adds 1-2 seconds delay on first click (loading the library)
2. **High DPI scale** (`devicePixelRatio`, often 2x or 3x) makes html2canvas render a canvas 4-9x larger than needed, dramatically slowing it down
3. **No visual feedback** while capturing - user doesn't know if the button worked
4. **Full body rendering** on complex pages (2800+ pipeline cards) is inherently slow

## Solution
One file changes: `src/components/feedback/ScreenshotFeedbackButton.tsx`

### Changes

**1. Pre-load html2canvas (eliminate first-click delay)**
- Move `import("html2canvas")` to a top-level static import instead of dynamic
- This loads the library when the app starts, not when the user clicks

**2. Reduce scale to 1 (4-9x speed improvement)**
- Change `scale: window.devicePixelRatio` back to `scale: 1`
- For feedback screenshots, pixel-perfect quality is unnecessary
- This is the single biggest performance improvement

**3. Show loading state on the button**
- While capturing, show a spinner icon on the camera button instead of hiding it
- This gives immediate visual feedback that the click registered

**4. Add `onclone` optimization**
- Use html2canvas's `onclone` callback to simplify the cloned DOM before rendering
- Remove animations and transitions in the clone to speed up rendering

## Technical Details

```text
File: src/components/feedback/ScreenshotFeedbackButton.tsx

Key changes:
1. Top of file: import html2canvas from "html2canvas" (static)
2. scale: 1 (instead of devicePixelRatio)
3. Add capturing state for spinner feedback
4. Add onclone to disable animations in the cloned DOM
5. Keep backgroundColor, ignoreElements, and all other settings unchanged
```

## No Other Changes
- No database changes
- No changes to AnnotationOverlay, AppLayout, or any other file
- Only ScreenshotFeedbackButton.tsx is modified

