
## Fix: Screenshot Should Capture Open Drawers/Panels

### Problem
When a detail panel (Sheet/Drawer) is open on the pipeline page, the screenshot tool only captures `#main-content` (line 34). Radix UI renders Sheets/Dialogs as portals on `document.body`, so they exist outside `#main-content` and are completely missed. The user sees the drawer close (because state changes during capture) and gets a screenshot without it.

### Solution

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

Change the capture target logic (line 34) to detect if a Radix overlay is currently open. If so, capture `document.body` instead of `#main-content`.

```text
Before:
  const target = document.getElementById("main-content") || document.body;

After:
  const hasOverlay = document.querySelector(
    '[data-radix-dialog-overlay], [role="dialog"], [data-state="open"][data-radix-dialog-content], [vaul-drawer]'
  );
  const target = hasOverlay ? document.body : (document.getElementById("main-content") || document.body);
```

When capturing `document.body`, update `rect` to use the full viewport dimensions (width/height from `window.innerWidth`/`window.innerHeight`, x/y at 0).

### Technical Details

- Only one line of logic changes in the capture function (line 34-35)
- The `baseOpts` width/height/x/y already derive from `rect`, so switching the target automatically adjusts the capture area
- The feedback button itself is already excluded via `data-feedback-btn="true"` in `ignoreElements`
- No other files need changes
