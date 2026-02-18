

# Fix: Screenshot Button - Two Critical Issues

## Issue 1: Button Not Clickable When Lead Drawer is Open

**Root cause**: Radix UI Dialog (used by the Sheet component for lead detail drawer) sets `pointer-events: none` on the `<body>` element when a dialog is open. This blocks the fixed-position camera button from receiving any click/pointer events, even though it's visually on top (z-9999).

**Fix**: Add `pointerEvents: "auto"` to the button's inline style. This overrides the inherited `pointer-events: none` from the body, making the button clickable regardless of whether a Sheet/Dialog is open.

## Issue 2: Still Freezing for 40 Seconds on Pipeline

**Root cause**: Even with `onclone` trimming, html2canvas still has to:
1. Clone the entire `document.body` DOM (2800+ elements) BEFORE `onclone` runs
2. The cloning itself blocks the main thread
3. The `Promise.race` timeout cannot fire while the main thread is blocked

**Fix**: Instead of relying on `onclone` alone, change the capture **target** from `document.body` to just the visible main content area. On the Pipeline page, there are portaled elements (the Sheet drawer) that we also want to capture. The solution:

1. Before calling html2canvas, clone only the visible portions manually into a temporary container
2. Or simpler: keep targeting `document.body` but make the trimming much more aggressive -- remove ALL off-screen elements, not just specific selectors
3. Most importantly: reduce the timeout to 5 seconds AND add a pre-capture DOM count check -- if DOM has more than 1500 elements, aggressively simplify BEFORE calling html2canvas (not just in onclone)

**Chosen approach**: Keep the current architecture but add a pre-capture step that hides off-screen heavy elements on the LIVE DOM momentarily (via `visibility: hidden; display: none`), captures, then restores them. This is faster than relying on `onclone` because html2canvas won't even clone those hidden elements.

## Technical Changes

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

1. Add `pointerEvents: "auto"` to button inline style (line 140)
2. Before `html2canvas()` call, add pre-capture DOM trimming:
   - Query all heavy off-screen elements in the LIVE DOM
   - Set `display: none` on them temporarily
   - Run html2canvas (now with far fewer elements to clone)
   - Restore all hidden elements immediately after
3. This moves the performance optimization BEFORE the blocking clone step

```text
Changes summary:

Button style (line 140):
  style={{ left: pos.x, top: pos.y, touchAction: "none", pointerEvents: "auto" }}

capture function:
  // Before html2canvas call:
  const hiddenEls: HTMLElement[] = [];
  if (isHeavyPage) {
    const heavySelectors = '[draggable="true"], [class*="card"], [class*="lead-"], tr, li';
    document.body.querySelectorAll(heavySelectors).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vpH + 50 || r.right < -50 || r.left > vpW + 50) {
        (el as HTMLElement).style.display = "none";
        hiddenEls.push(el as HTMLElement);
      }
    });
  }
  
  // ... html2canvas call ...
  
  // After capture (in finally block):
  hiddenEls.forEach(el => el.style.display = "");
```

## No Other Changes
- No database changes
- No changes to Sheet component, LeadDetailDrawer, AppLayout, or any other file
- Only ScreenshotFeedbackButton.tsx is modified
