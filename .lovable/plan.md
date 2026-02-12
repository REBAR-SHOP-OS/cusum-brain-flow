

# Make Brain Neuro-Electric, Dynamic, Visible -- Responsive for All Devices

Full rewrite of `InteractiveBrainBg.tsx` to create a dramatic neuro-electric effect that scales properly across mobile, tablet, and desktop.

---

## Problems with Current Implementation

- Brain image uses `w-[95vh] h-[95vh]` -- overflows on mobile and short viewports
- Particle orbit radius is fixed at 260-420px -- flies off-screen on small devices
- Glow layers use `120vw`/`85vw` -- causes horizontal overflow on mobile
- Neural lines use fixed percentage positions that don't adapt
- Mouse interaction (`onMouseMove`) does nothing on touch devices
- Overall opacity too low (30%) to be visible, especially on small bright screens

## Changes to `src/components/brain/InteractiveBrainBg.tsx`

### 1. Responsive Brain Image
- Replace `w-[95vh] h-[95vh] max-w-[1100px]` with responsive sizing:
  - Mobile: `w-[80vw] h-[80vw]` (viewport-width based so it fits)
  - Tablet: `w-[60vw] h-[60vw]`
  - Desktop: `w-[50vh] h-[50vh] max-w-[700px]`
- Use CSS `clamp()` for smooth scaling: `width: clamp(250px, 70vmin, 700px)`
- Increase opacity from `0.3` to `0.55`
- Add cyan tint overlay via `filter: drop-shadow + hue-rotate`

### 2. Responsive Glow Layers
- Outer glow: Change from `120vw` to `min(120vw, 120vh)` using `vmin` units
- Inner glow: Same approach, boost opacity to `0.3-0.5` range
- Use `vmin` throughout so glows never exceed the smaller viewport dimension

### 3. Responsive Particles
- Increase count from 10 to 20
- Make orbit radius responsive: `clamp(80, 15vmin, 300)` instead of fixed 260-420px
- Bigger sizes (4-10px) with electric cyan glow `box-shadow: 0 0 12px`
- Add spark keyframe for random bright flashes

### 4. Touch Support
- Add `onTouchMove` handler that maps touch position to offset (same as mouse)
- Add `onTouchEnd` to reset offset (same as mouseLeave)
- Keeps interactivity working on phones and tablets

### 5. Electric Neural Network (SVG)
- Increase from 5 to 12 neural lines
- Use `viewBox="0 0 100 100"` with percentage-based coordinates so they scale
- Boost opacity from `0.06` to `0.18`
- Add animated pulse dots traveling along paths
- Add 3 jagged arc paths with flicker animation

### 6. Scanning Ring Effect
- A thin circle that expands from center and fades out every 4 seconds
- Uses `vmin` sizing so it scales with viewport

### 7. New Keyframes
- `electric-spark`: 0.15s bright flash
- `arc-flicker`: rapid opacity oscillation for lightning arcs
- `scan-ring`: expanding circle fade
- `pulse-dot`: dot traveling along stroke path
- Updated `brain-pulse`: higher opacity range (0.3 to 0.5)

---

## Files Modified
- `src/components/brain/InteractiveBrainBg.tsx` -- full rewrite of effects layer

## No Other Changes
- `Brain.tsx` stays the same (just mounts the component)
- No new dependencies
- No schema changes

