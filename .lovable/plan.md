
# Fix: Screenshot Button Producing Black/Empty Images

## Problem
The `backgroundColor: null` setting in `html2canvas` causes transparent backgrounds, which render as **black** in most PNG viewers and when displayed in the annotation overlay. This is a well-documented issue with html2canvas.

## Solution
Only one file changes: `src/components/feedback/ScreenshotFeedbackButton.tsx`

### Changes

**1. Fix `backgroundColor` from `null` to actual page background**
- Change `backgroundColor: null` to `backgroundColor: "#0f1729"` (the app's dark background color)
- Alternatively, dynamically read it: `getComputedStyle(document.documentElement).backgroundColor`
- This prevents the black/transparent image issue

**2. Add `logging: true` temporarily for debug, then revert**
- Actually, better approach: keep `logging: false` but add a validation check after capture to detect blank canvas

**3. Add fallback and validation**
- After `canvas.toDataURL()`, check if the data URL is suspiciously small (indicates blank capture)
- If blank, retry once with a slight delay
- Show a meaningful error if still failing

### Specific Code Changes

In the `capture` callback, change:
```typescript
// FROM:
backgroundColor: null,

// TO:
backgroundColor: getComputedStyle(document.documentElement).backgroundColor || "#0f172a",
```

This single change should fix the black/empty screenshot issue. The dynamic approach reads whatever the current theme background is, so it works with both dark and light themes.

## No Other Changes
- No database changes
- No changes to AnnotationOverlay, AppLayout, or any other file
- No changes to the drag/position logic
