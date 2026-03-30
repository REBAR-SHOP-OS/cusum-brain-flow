

# Professional Video Editor Timeline — Premiere Pro / CapCut Style

## Overview
Rebuild the TimelineBar component into a high-performance, professional-grade timeline editor with 60fps playhead, sub-second precision, zoom, snapping, and a modern dark UI — while preserving all existing functionality (scene management, audio tracks, text overlays, drag-reorder).

## Architecture

```text
TimelineBar.tsx (refactored)
├── TimeRuler         — dynamic tick marks (s + ms at zoom), zoom-aware
├── PlayheadLine      — rAF-driven smooth playhead, draggable
├── VideoTrack        — scene blocks with thumbnails, resize handles
├── TextTrack         — text overlay blocks, drag-to-reposition
├── AudioTrack        — audio blocks, global positioning
├── SnapGuides        — vertical snap lines at scene boundaries
└── TransportBar      — play/pause, time display (mm:ss:ms), zoom slider
```

## Key Changes

### 1. 60fps Playhead via requestAnimationFrame
**File**: `TimelineBar.tsx`
- Replace CSS `transition: left 0.1s` with `requestAnimationFrame` loop
- Use a ref to store interpolated position, update DOM directly (bypass React re-renders)
- During scrub: position follows mouse at native frame rate
- During playback: interpolate between React state updates

### 2. High-Precision Time Ruler
- Dynamic tick density based on zoom level:
  - Zoom < 2x: major ticks every 1s, minor every 0.5s
  - Zoom 2-5x: major every 0.5s, minor every 100ms
  - Zoom > 5x: major every 100ms, minor every 10ms (frame-level)
- Show millisecond labels at high zoom
- Ruler scrolls horizontally with timeline content

### 3. Zoom System Enhancement
- Current: 0.5x–5x range, button-based
- New: 0.5x–20x range, Ctrl+scroll wheel zoom centered on cursor position
- Zoom slider in transport bar for precise control
- Auto-scroll to keep playhead visible during zoom

### 4. Snapping System
- Snap targets: scene boundaries, playhead, other clip edges
- Visual snap guides: vertical dashed lines when within 5px threshold
- Hold Alt to disable snapping temporarily
- Apply to: playhead scrub, clip drag, clip resize

### 5. Transport Bar (bottom controls)
- Play/Pause button (Space hotkey)
- Skip to start/end buttons
- Current time display: `mm:ss:ms` format (e.g., `01:23:450`)
- Total duration display
- Zoom slider (horizontal)
- Frame step buttons (← →, 1 frame = 16ms)

### 6. Dark Theme Professional UI
- Timeline background: `bg-zinc-950` with subtle grid pattern
- Track lanes: alternating `bg-zinc-900/50` and `bg-zinc-900/30`
- Playhead: bright red line with triangular head (like Premiere)
- Scene blocks: rounded with gradient, drop shadow on hover
- Selected clip: bright outline glow
- Smooth hover/select transitions

### 7. Performance Optimizations
- Playhead position via ref + direct DOM manipulation (no state updates at 60fps)
- Memoize scene width calculations
- Virtualize ruler ticks (only render visible ones based on scroll position)
- Use `will-change: transform` on playhead and dragged elements
- Debounce zoom wheel events

## Files to Change

1. **`src/components/ad-director/editor/TimelineBar.tsx`** — Major refactor:
   - Add rAF playhead system
   - Dynamic zoom-aware ruler
   - Snap guide overlay
   - Transport bar section
   - Dark professional styling
   - Keyboard shortcuts (Space, Alt, arrow keys)
   - All existing props/callbacks preserved

2. **`src/components/ad-director/ProVideoEditor.tsx`** — Minor updates:
   - Pass `isPlaying` and `onTogglePlay` to TimelineBar
   - Pass `onFrameStep` callback for frame-by-frame navigation

## Preserved Functionality
All existing features remain intact:
- Scene drag-to-reorder, resize handles, popover menus
- Audio track global positioning (just implemented)
- Text overlay track with drag
- Thumbnail extraction
- Compact/expanded view toggle
- Volume controls
- All action buttons (split, stretch, duplicate, mute, delete, regenerate)

## Result
A timeline that feels like Premiere Pro: smooth 60fps playhead, precise zoom with ms-level ticks, snap guides, keyboard shortcuts, and a clean dark professional aesthetic — all within the existing React + Tailwind stack.

