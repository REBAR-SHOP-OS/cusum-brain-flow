

# Fix: Screenshot on Pipeline - Under 2 Seconds

## Root Cause

The Pipeline page has 2800+ lead cards in the DOM. `html2canvas` clones the **entire** `document.body` and re-renders every single element -- even cards scrolled far off-screen. The 3-second timeout does NOT help because html2canvas blocks the main thread during rendering, so the UI freezes regardless.

## Solution

Only one file changes: `src/components/feedback/ScreenshotFeedbackButton.tsx`

### The Key Fix: Trim Off-Screen Elements in `onclone`

The `onclone` callback runs on a **cloned copy** of the DOM before html2canvas renders it. We will use this to **remove all elements outside the viewport** from the clone. This means html2canvas only renders the ~50-100 visible elements instead of 2800+.

### Changes

**1. Aggressive DOM trimming in `onclone`**
- After cloning, walk through all elements in the cloned DOM
- Remove any element whose bounding rect (from the original DOM) is fully outside the viewport
- Target specifically pipeline card elements and other heavy off-screen content
- This reduces rendering from 2800+ elements to only ~50-100 visible ones

**2. Increase timeout to 5 seconds (safety margin)**
- The 3-second timeout was too aggressive for even normal pages
- With DOM trimming, capture should take under 2 seconds, but keep 5s as safety

**3. Skip images on first attempt for Pipeline**
- On pages with many elements (detected via DOM count), start with `imageTimeout: 0`
- This avoids waiting for avatar images to load via CORS

### Technical Implementation

```text
File: src/components/feedback/ScreenshotFeedbackButton.tsx

In onclone callback:
1. Collect bounding rects of all elements BEFORE cloning (from live DOM)
2. In the cloned DOM, find matching elements and remove those fully off-screen
3. This is safe because it only modifies the clone, not the live page

Pseudo-code for onclone:
  onclone: (clonedDoc) => {
    // Disable animations (existing)
    ...
    
    // Collect all elements and check visibility
    const allOriginal = document.body.querySelectorAll('*');
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    
    // Build a set of data-attributes marking off-screen elements
    // Then remove them from the cloned DOM
    // Key: only remove leaf/heavy elements, keep structural containers
    
    // Target: pipeline cards, list items, table rows that are off-screen
    const clonedAll = clonedDoc.body.querySelectorAll(
      '[class*="card"], [class*="lead-"], [draggable="true"]'
    );
    // For each, check if original counterpart was in viewport
    // If not, remove from clone
  }
```

### Why This Works
- `html2canvas` speed is proportional to the number of elements it renders
- 2800 elements takes 40 seconds; 100 elements takes under 1 second
- The `onclone` approach is safe: it never touches the live DOM
- The user sees the exact same screenshot (only visible content matters)

## No Other Changes
- No database changes
- No changes to AnnotationOverlay, Pipeline page, or any other file
- Only ScreenshotFeedbackButton.tsx is modified
