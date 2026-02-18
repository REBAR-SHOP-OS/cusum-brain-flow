

# Fix: Screenshot Memory Crash and Freeze

## Root Cause

The Pipeline page has ~2800 lead cards distributed across scrollable columns (`overflow-y: auto`). The current pre-hide logic checks each card's `getBoundingClientRect()` against the window viewport -- but cards scrolled out of view **inside a scrollable column** still report coordinates within the viewport (because the column container itself is visible). So nearly ALL 2800 cards survive the filter and get cloned by `html2canvas`, causing 170MB+ memory usage and a complete UI freeze.

## Solution

Replace the viewport-based filtering with **scroll-container-aware filtering**. For each scrollable container inside the target, calculate which children are actually visible within the scroll area, and hide everything else before capture.

Also add an **element count cap**: if after filtering there are still more than 500 elements, progressively hide more until the count is manageable.

## File: `src/components/feedback/ScreenshotFeedbackButton.tsx`

### Changes

**1. New pre-hide logic: scroll-container-aware trimming**

Instead of checking `getBoundingClientRect()` against the window, find all scrollable containers (`overflow-y: auto` or `scroll`) inside the target. For each scrollable container, get its visible scroll area and hide all children whose position is outside that visible scroll window.

```text
// Pseudo-code:
const scrollContainers = target.querySelectorAll('*');
scrollContainers.forEach(container => {
  if (container.scrollHeight > container.clientHeight) {
    // This is a scroll container
    const containerRect = container.getBoundingClientRect();
    const visibleTop = containerRect.top;
    const visibleBottom = containerRect.bottom;
    
    // Hide children outside the visible scroll area
    container.children.forEach(child => {
      const childRect = child.getBoundingClientRect();
      if (childRect.bottom < visibleTop - 20 || childRect.top > visibleBottom + 20) {
        child.style.display = 'none';
        hiddenEls.push(child);
      }
    });
  }
});
```

**2. Element count safety cap**

After scroll-aware trimming, check remaining element count. If still above 500, hide additional non-visible elements (deeper nested items like list items, table rows).

**3. Lower scale for heavy pages**

On pages with more than 1000 remaining elements after trimming, reduce `scale` from 1 to 0.5. This cuts canvas memory usage by 75% while still producing a usable screenshot for feedback purposes.

**4. Keep everything else the same**
- Target remains `main-content`
- `pointerEvents: "auto"` stays
- Retry logic stays
- Restore logic in `finally` stays
- 5s timeout stays

### Why This Fixes the Problem

The Pipeline has 6-8 columns, each with `overflow-y: auto` and hundreds of cards. Only ~5-10 cards per column are actually visible in the scroll window. This new logic will correctly identify and hide the ~2700 invisible cards, leaving only ~50-80 elements for html2canvas to process. Result: under 2 seconds, no memory spike, no freeze.

