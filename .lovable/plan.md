

## Fix Screenshot Tool Memory Crash on Heavy Pages

### Problem
The screenshot feedback button (camera icon) crashes the page on heavy views like the Kanban pipeline. The root cause is in `ScreenshotFeedbackButton.tsx` lines 65-89:

1. `target.querySelectorAll("*")` iterates every single DOM element inside `#main-content` -- on a Kanban board with 2800+ cards this means tens of thousands of elements
2. For each scrollable container found, it then loops through all children checking bounding rects -- triggering forced layout reflows
3. A second pass at line 82 queries again for `tr, li, [class*="card"]` elements
4. All of this happens synchronously on the main thread, causing memory spikes and page freezes

### Solution

Rewrite the DOM trimming strategy to be lightweight and targeted:

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

1. **Replace generic `querySelectorAll("*")` with targeted selectors** -- only look for known heavy containers (scroll areas, kanban columns, table bodies) instead of every element in the DOM
2. **Cap the trimming depth** -- only process direct children of scroll containers, not deeply nested elements
3. **Use `visibility: hidden` instead of `display: none`** -- avoids layout reflow cascades
4. **Add an element count pre-check** -- if the DOM has more than 3000 visible elements, skip html2canvas entirely and fall back to a simpler approach (capture only the viewport via a reduced-scope clone)
5. **Wrap the trimming in a try/catch with a fast timeout** -- if trimming itself takes more than 500ms, abort and use fallback

### Technical Details

The revised `capture` function will:

```
1. Count elements: target.querySelectorAll("*").length
2. If count > 3000 (heavy page):
   - Find top-level scroll containers only (max depth 3)
   - For each, hide children outside viewport using visibility:hidden
   - Force scale to 0.4, imageTimeout to 0
   - Set a 3-second hard timeout
3. If count <= 3000 (normal page):
   - Keep existing logic with minor cleanup
4. Restore all hidden elements in finally block (same as current)
```

This prevents the recursive DOM walking that causes the crash while still producing a usable screenshot.

