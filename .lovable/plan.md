

# Fix: Screenshot Button - Robust, Fast, and Reliable on Pipeline

## Root Cause Analysis

The Pipeline page has **2816 leads** rendered across multiple columns. When `html2canvas` targets `document.body`, it must **clone and re-render the entire DOM** -- thousands of card elements, avatars, badges, etc. This causes:

1. **Slowness**: Cloning 2800+ cards takes several seconds
2. **Failures**: The massive cloned DOM can exhaust memory or hit browser limits, causing silent failures
3. **`allowTaint: true`**: This setting can cause `canvas.toDataURL()` to throw a security error if any cross-origin image is drawn, resulting in a silent fail (no screenshot, no error toast)

## Solution

Only one file changes: `src/components/feedback/ScreenshotFeedbackButton.tsx`

### Changes

**1. Fix `allowTaint` (critical bug fix)**
- Change `allowTaint: true` to `allowTaint: false`
- With `allowTaint: true`, any cross-origin image (e.g., avatar URLs) taints the canvas, and `toDataURL()` throws a `SecurityError`
- Combined with `useCORS: true`, cross-origin images will either load via CORS or be skipped -- but the canvas stays usable

**2. Add timeout wrapper (3-second limit)**
- Wrap `html2canvas()` in a `Promise.race` with a 3-second timeout
- If html2canvas takes longer than 3 seconds, the timeout wins and triggers retry

**3. Add automatic retry (1 retry with simplified settings)**
- On first failure or timeout, retry once with simplified settings:
  - `imageTimeout: 0` (skip all images entirely for speed)
  - This ensures the layout/text is captured even if images are problematic
- User only clicks once; retry is automatic and invisible

**4. Disable button during capture**
- Button is already disabled via `capturing` state + cooldown ref -- this is already implemented and working

**5. Better error handling**
- After `toDataURL()`, validate the output length (detect blank/corrupt canvas)
- If dataUrl is suspiciously small (less than 1KB), treat as failure and retry
- Log detailed error info including page path and DOM element count for debugging

## Technical Details

```text
File: src/components/feedback/ScreenshotFeedbackButton.tsx

Key changes:

1. allowTaint: false (instead of true) -- prevents SecurityError on toDataURL
2. Timeout wrapper: Promise.race([html2canvas(...), timeout(3000)])
3. Retry logic: on failure/timeout, retry once with imageTimeout: 0
4. Validation: check dataUrl.length > 1000 before accepting
5. All other settings (scale:1, backgroundColor, ignoreElements, onclone) unchanged
```

### Code Structure

```text
capture = async () => {
  // ... existing guards and setup ...
  
  const captureOnce = (skipImages: boolean) => {
    const opts = {
      useCORS: true,
      allowTaint: false,        // <-- FIX: was true
      scale: 1,
      width: window.innerWidth,
      height: window.innerHeight,
      // ... same viewport settings ...
      imageTimeout: skipImages ? 0 : 5000,
      // ... same ignoreElements, onclone, backgroundColor ...
    };
    return Promise.race([
      html2canvas(document.body, opts),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
    ]);
  };

  try {
    let canvas = await captureOnce(false);        // Attempt 1: full capture
    let dataUrl = canvas.toDataURL("image/png");
    
    if (dataUrl.length < 1000) throw new Error("blank canvas");
    
    setScreenshot(dataUrl);
    setOverlayOpen(true);
  } catch (err) {
    // Retry once with images disabled
    try {
      let canvas = await captureOnce(true);
      let dataUrl = canvas.toDataURL("image/png");
      if (dataUrl.length < 1000) throw new Error("blank canvas after retry");
      setScreenshot(dataUrl);
      setOverlayOpen(true);
    } catch (retryErr) {
      console.error("Screenshot failed after retry:", retryErr);
      toast.error("Failed to capture screenshot");
    }
  }
};
```

## No Other Changes
- No database changes
- No changes to AnnotationOverlay, AppLayout, Pipeline page, or any other file
- Only ScreenshotFeedbackButton.tsx is modified
