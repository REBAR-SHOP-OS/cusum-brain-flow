

## Problem

The website preview iframe in desktop mode takes `width: 100%` of its panel container. Because the panel is only ~70% of the screen width (split with chat), the iframe is roughly 680px wide. The rebar.shop site's responsive breakpoints see this narrow width and render its mobile/tablet layout instead of desktop.

## Solution

Use a CSS scaling technique: render the iframe at a fixed desktop width (1440px) and scale it down to fit the container using `transform: scale()`. This way the site "thinks" it has a full desktop viewport.

## Changes

**File: `src/pages/WebsiteManager.tsx`**

1. Add a ref to measure the container's actual width
2. For desktop mode, set iframe width to 1440px and apply `transform: scale(containerWidth / 1440)` with `transform-origin: top left`
3. Tablet and mobile modes keep their current fixed-width behavior (768px and 375px respectively), also scaled to fit if needed
4. Use a `ResizeObserver` on the container to update the scale factor dynamically when the user resizes the panel

The iframe wrapper will use:
```
width: 1440px (desktop) / 768px (tablet) / 375px (mobile)
transform: scale(availableWidth / targetWidth)
transform-origin: top left
height: calculated inverse to maintain aspect
```

No other files change. No UI redesign. Just the preview panel rendering logic.

