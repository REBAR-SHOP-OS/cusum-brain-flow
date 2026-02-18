

# Fix: Screenshot Under 2 Seconds -- Target Only Visible Content

## Problem
`html2canvas(document.body, ...)` clones the ENTIRE page DOM (2800+ elements including sidebar, nav, off-screen cards). Even with pre-hiding, the clone operation itself is slow and blocks the main thread.

## Solution
Change the capture target from `document.body` to `document.getElementById("main-content")` -- the `<main>` element that wraps only the page content. This immediately reduces the DOM to just what the user sees.

## File: `src/components/feedback/ScreenshotFeedbackButton.tsx`

### Changes:

1. **Change capture target**: Replace `document.body` with `document.getElementById("main-content") || document.body` in both `captureOnce` calls
2. **Keep pre-hide logic** for safety (still helps if main-content has many off-screen cards in scrollable columns)
3. **Adjust `width`/`height`** to use the target element's dimensions instead of `window.innerWidth/Height`
4. **Remove `onclone` heavy trimming** -- no longer needed since we're not capturing the full body

### Technical Detail

```text
Current (slow):
  html2canvas(document.body, opts)  // clones sidebar + nav + 2800 cards

Fixed (fast):
  const target = document.getElementById("main-content") || document.body;
  const rect = target.getBoundingClientRect();
  // opts use rect.width, rect.height
  html2canvas(target, opts)  // clones only visible pipeline area
```

The `<main id="main-content">` element already exists in `AppLayout.tsx` and wraps exactly the page content area (no sidebar, no top nav). This gives html2canvas a much smaller DOM tree to clone and render.

### What stays the same
- `pointerEvents: "auto"` on button (keeps it clickable over drawers)
- `useCORS: true`, `allowTaint: false`
- Retry logic with fallback
- Timeout safety net (5s)
- Pre-hide off-screen elements (still useful for heavy scroll areas)
- No changes to any other file

