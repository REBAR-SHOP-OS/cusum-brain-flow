

## Plan: Viewport-Only Screenshot on Pipeline Page

### What Changes

On the `/pipeline` route (and other heavy pages), skip the overflow expansion logic entirely and capture only the visible viewport area. This prevents crashes and captures exactly what the user sees.

### How

**File: `src/components/feedback/ScreenshotFeedbackButton.tsx`**

#### 1. Detect heavy pages and skip expansion (lines 41-67)

After determining the target, check if the page is heavy (>3000 elements). If so, skip all the `expand()` logic that removes overflow constraints on ancestors — this is what causes the canvas to balloon.

```typescript
const isHeavyRoute = target.querySelectorAll("*").length > 3000;

// Only expand overflow on lighter pages
if (!isOverlay && !isHeavyRoute && target instanceof HTMLElement) {
  // ... existing expand logic stays
}
```

#### 2. Use viewport dimensions for heavy pages (lines 69-71)

For heavy pages, use `window.innerWidth` / `window.innerHeight` instead of `scrollWidth` / `scrollHeight`:

```typescript
const captureWidth  = (isOverlay || isHeavyRoute) ? window.innerWidth  : Math.min(target.scrollWidth, MAX_DIM);
const captureHeight = (isOverlay || isHeavyRoute) ? window.innerHeight : Math.min(target.scrollHeight, MAX_DIM);
```

#### 3. Move `totalCount` / `isHeavyPage` detection earlier (line 116-118)

The element count check currently happens *after* the expansion. Move it before so we can use `isHeavyRoute` to gate expansion. Consolidate the two checks into one.

### Result

- Pipeline and other heavy pages: captures exactly what's on screen — fast, no crash
- Normal pages: still captures full scrollable content as before
- Overlay/dialog: unchanged

### Files Changed
1. `src/components/feedback/ScreenshotFeedbackButton.tsx` — reorganize element count detection and gate expansion + dimensions on it

