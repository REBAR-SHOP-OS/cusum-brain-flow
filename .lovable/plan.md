

# Fix: Screenshot Feedback Button - Complete and Accurate Capture

## Problem
The screenshot feedback button (camera icon) has multiple issues:
1. The CRM Pipeline's right-side detail panel (Sheet/Drawer) renders via a **portal to document.body**, so it's **outside** `#main-content` and never captured
2. Using `scrollHeight` captures the full scrollable content instead of the visible viewport
3. `scale: 1` gives low quality on high-DPI screens
4. The `scrollY` offset logic is wrong (scroll happens inside the container, not the window)

## Solution
Only one file changes: `src/components/feedback/ScreenshotFeedbackButton.tsx`

### Changes

**1. Capture from `document.body` instead of `#main-content`**
- Portaled elements (Sheet, Dialog, etc.) render directly on `document.body`
- We must capture from `document.body` to include overlays, drawers, and panels
- The feedback button itself is hidden during capture and also filtered via `ignoreElements`

**2. Capture only the visible viewport (not scrollHeight)**
- Set `width: window.innerWidth`, `height: window.innerHeight`
- Remove `scrollHeight`/`scrollWidth` overrides
- Remove the `scrollY` offset hack

**3. Wait for fonts and rendering before capture**
- `await document.fonts.ready`
- Double `requestAnimationFrame` to ensure the browser has painted

**4. Use `window.devicePixelRatio` for better quality**
- `scale: window.devicePixelRatio` for crisp screenshots on Retina/HiDPI displays

**5. Ignore floating UI elements that shouldn't appear**
- Continue ignoring elements with `data-feedback-btn="true"`
- Also ignore the Vizzy floating button if present

**6. Better error logging**
- Log the full error with stack trace to console
- Show descriptive toast error with page context

## Technical Details

```text
File: src/components/feedback/ScreenshotFeedbackButton.tsx

Before:
  target = document.getElementById("main-content") || document.body
  html2canvas(target, {
    scale: 1,
    scrollY: -window.scrollY,
    height: target.scrollHeight,
    windowHeight: target.scrollHeight,
    width: target.scrollWidth,
    windowWidth: target.scrollWidth,
  })

After:
  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  
  target = document.body
  html2canvas(target, {
    scale: window.devicePixelRatio || 1,
    width: window.innerWidth,
    height: window.innerHeight,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    backgroundColor: null,
  })
```

## No Other Changes
- No database changes
- No changes to AnnotationOverlay, AppLayout, or any other file
- No changes to the upload/send logic (already works correctly)

