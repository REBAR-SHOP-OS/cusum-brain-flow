

## Fix: Full-Page Screenshot Capture

### Problems
1. **Incomplete capture**: `#main-content` has `overflow: hidden`, so `scrollWidth`/`scrollHeight` only report the visible viewport. Kanban columns and long lists are clipped.
2. **Trimming hides content**: Lines 83-109 actively hide off-screen children in scroll containers, making the capture even more incomplete.
3. **Errors on problematic elements**: If any element causes `html2canvas` to fail, the entire capture breaks silently.

### Solution

Modify `src/components/feedback/ScreenshotFeedbackButton.tsx` with three changes:

**Change 1: Remove the trimming logic (lines 83-109)**
Delete the entire "Lightweight trimming" block that hides off-screen children. This is counterproductive when we want full-page capture.

**Change 2: Add pre-capture expansion before dimension measurement (after line 38)**
Before reading `scrollWidth`/`scrollHeight`, temporarily expand all overflow-clipping containers:

```typescript
const expandedEls: { el: HTMLElement; orig: string }[] = [];
const expand = (el: HTMLElement, css: string) => {
  expandedEls.push({ el, orig: el.style.cssText });
  el.style.cssText += css;
};

if (!isOverlay && target instanceof HTMLElement) {
  // Expand #main-content
  expand(target, "; overflow: visible !important; height: auto !important;");
  // Expand horizontal scrollers (kanban board)
  target.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-x-scroll')
    .forEach(el => expand(el, "; overflow: visible !important; height: auto !important;"));
  // Expand vertical scroll containers (columns, lists)
  target.querySelectorAll<HTMLElement>('[data-radix-scroll-area-viewport], .overflow-y-auto, .overflow-y-scroll, .overflow-auto')
    .forEach(el => expand(el, "; overflow: visible !important; max-height: none !important; height: auto !important;"));
}
```

Then measure dimensions **after** expansion so `scrollWidth`/`scrollHeight` reflect full content.

**Change 3: Restore expanded elements in `finally` block (after line 179)**
```typescript
expandedEls.forEach(({ el, orig }) => { el.style.cssText = orig; });
```

**Change 4: Improve error resilience in `onclone`**
Wrap element replacements in try-catch so a single problematic element doesn't abort the entire capture. Also increase timeout for expanded pages since they're larger.

### File to modify
`src/components/feedback/ScreenshotFeedbackButton.tsx`

### What changes
- Full scrollable content is captured (all kanban columns, all list items)
- No more hidden elements during capture
- Individual element errors won't crash the whole capture
- Styles are always restored in `finally` block

### What does NOT change
- AnnotationOverlay, submission flow, voice input — all unchanged
- No database or backend changes

