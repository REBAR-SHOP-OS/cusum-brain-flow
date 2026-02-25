

## Fix: Screenshot Captures Full Scrollable Page Content

### Problem

When taking a screenshot from the bottom of the `/home` page, only the visible viewport area is captured. The content above/below the fold is cut off.

**Root cause:** The layout has multiple nested `overflow-hidden` containers:

```text
div.flex.flex-col.h-screen          ← h-screen
  div.flex.flex-1.overflow-hidden   ← clips content
    main#main-content.overflow-hidden  ← clips content
      <ScrollArea>                     ← Radix scroll viewport
        <actual page content>          ← full height
```

The current capture code expands the `main-content` target and its inner scroll containers, but does **not** walk up the DOM to expand ancestor containers that also clip with `overflow-hidden`. So even though the Radix scroll viewport gets expanded, the parent `div` and `main` still clip the rendered output.

### Fix

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

After expanding the target and its children, also walk **up** the DOM from the target to `document.body`, expanding any ancestor that has `overflow: hidden`, `overflow: auto`, or `overflow: scroll`, plus removing fixed `height` constraints like `h-screen`.

Add this block after the existing child-expansion logic (after line 56):

```typescript
// Walk up ancestors to remove clipping
let parent = target.parentElement;
while (parent && parent !== document.body) {
  const cs = getComputedStyle(parent);
  if (cs.overflow !== "visible" || cs.overflowY !== "visible" || cs.overflowX !== "visible") {
    expand(parent, "; overflow: visible !important; max-height: none !important; height: auto !important;");
  }
  parent = parent.parentElement;
}
```

This ensures that every clipping ancestor (the `flex-1 overflow-hidden` wrapper, the `h-screen` root) temporarily allows content to overflow during capture, then gets restored in the `finally` block.

### What stays the same
- Overlay/dialog screenshot logic (uses `window.innerWidth/Height`, unaffected)
- The restore logic in `finally` already handles all expanded elements
- Retry-without-images fallback, timeouts, heavy page detection

### Technical detail
The `expandedEls` array already tracks every modified element and restores `style.cssText` in the `finally` block, so this change is safe — no permanent layout side effects.

