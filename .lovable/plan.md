

# Fix Homepage Rendering — Prevent Blank Hero

## Analysis

The Landing page (`src/pages/Landing.tsx`) is **entirely static** — no API calls to `erp.rebar.shop` or any external service. All data (STATS, PROBLEMS, MODULES, etc.) is hardcoded. The `PublicChatWidget` calls an edge function but is independent and non-blocking.

**Root causes of intermittent blank hero:**
1. **No error boundary** — Landing is a public route (`<Route path="/" element={<Landing />} />`) with no `SmartErrorBoundary` wrapper. If `InteractiveBrainBg` or `AnimatedCounter` (framer-motion) throws, the entire page goes blank.
2. **`useAuth` blocking** — Landing calls `useAuth()` and shows a full-screen spinner while `loading` is true. If auth takes long or errors, users see blank/spinner indefinitely.
3. **`InteractiveBrainBg`** uses complex SVG animations, `requestAnimationFrame`, and CSS animations that can error on certain browsers.
4. **`AnimatedCounter`** depends on `framer-motion` spring/transform — if framer-motion fails to load (chunk error), the whole hero crashes.
5. **`PublicChatWidget`** makes network calls on mount — if it throws, it takes down the page.

## Changes

### 1. `src/App.tsx` — Wrap Landing in error boundary
- Add `SmartErrorBoundary` around the Landing route element

### 2. `src/pages/Landing.tsx` — Add resilience
- Wrap `InteractiveBrainBg` in try/catch error boundary (inline or component-level)
- Wrap `AnimatedCounter` usage with a lightweight error boundary that falls back to static text
- Add a timeout on `useAuth` loading state: if loading > 3 seconds, render the page anyway (treat as not logged in)
- Wrap `PublicChatWidget` in error boundary

### 3. `src/components/brain/InteractiveBrainBg.tsx` — Add safety
- Wrap the entire render in a try/catch at the component level
- If any error, return a simple gradient fallback div (no blank)

### 4. Create `src/components/landing/LandingSectionBoundary.tsx`
- Lightweight error boundary component for landing sections
- On error: renders nothing (section disappears gracefully) instead of crashing the page
- Logs error to console with clear message

### 5. `src/pages/Landing.tsx` — Skeleton/loading states
- Replace the full-screen Loader2 spinner with a skeleton layout showing header + hero placeholder
- This ensures visible content appears immediately even during auth check

## Files Changed
- `src/App.tsx` — wrap Landing route in SmartErrorBoundary
- `src/pages/Landing.tsx` — auth timeout, wrap sections in LandingSectionBoundary, skeleton loading
- `src/components/landing/LandingSectionBoundary.tsx` — new lightweight error boundary
- `src/components/brain/InteractiveBrainBg.tsx` — safe render with fallback

## Result
Homepage always renders visible content. Individual sections fail silently without taking down the page. No white screen under any condition.

