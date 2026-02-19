

# Fix: Screenshot Feedback Button Not Visible for neel@rebar.shop

## Problem
User neel@rebar.shop cannot see the screenshot feedback button (camera icon). The code logic is correct -- their email passes the `@rebar.shop` check -- but the button may be invisible due to:
1. Previously dragged off-screen position saved in localStorage
2. Poor contrast on dark pages like `/empire`

## Solution
Two defensive fixes in `src/components/feedback/ScreenshotFeedbackButton.tsx`:

### Fix 1 -- Validate saved position on mount
Add a safety check that re-clamps the button position on every mount (not just resize), ensuring it's always within the visible viewport. This handles the case where the user switched devices or the saved position is stale.

### Fix 2 -- Add visible ring/outline for dark pages
Add a subtle light ring (`ring-1 ring-white/30`) to the button so it's clearly visible against dark backgrounds like the Empire Builder page.

## Technical Details

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

1. After the `useDraggablePosition` hook returns `pos`, add a `useEffect` that re-clamps the position to the current viewport on mount:
```tsx
useEffect(() => {
  const maxX = window.innerWidth - BTN_SIZE;
  const maxY = window.innerHeight - BTN_SIZE;
  if (pos.x > maxX || pos.y > maxY || pos.x < 0 || pos.y < 0) {
    // Position is off-screen, reset to default
    const defaultX = window.innerWidth - BTN_SIZE - 24;
    const defaultY = window.innerHeight - BTN_SIZE - 96;
    localStorage.removeItem("feedback-btn-pos");
  }
}, []);
```

2. Add a visible ring to the button className:
```
"ring-1 ring-white/30"
```
This ensures the button is visible on both light and dark pages.

**File: `src/hooks/useDraggablePosition.ts`**

Add a `resetPos` function that can be called to reset the position externally, or better yet, validate on initialization in `loadPos`:
- In the `loadPos` function, after parsing the stored position, check if it's within the current viewport bounds. If not, return the default position and clear the stored value.

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useDraggablePosition.ts` | Validate stored position is within viewport bounds on load; discard if off-screen |
| `src/components/feedback/ScreenshotFeedbackButton.tsx` | Add `ring-1 ring-white/30` to button for visibility on dark pages |

