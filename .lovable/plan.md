

# Redesign Preview & Export as Canva-Style Editor

## Current State
The `ProVideoEditor` uses a vertical stacked layout: video → AI command bar → horizontal tabs → tab content → action bar. Everything flows top-to-bottom.

## Target Layout (from Canva screenshot)
A 3-panel layout with bottom timeline:

```text
┌──────────────┬────────────────────────────┬──────────────┐
│  Left Sidebar │      Video Canvas          │ Right Panel  │
│  (icon nav +  │      (playback controls)   │ (Fade, FX,   │
│   tab content)│                            │  Speed, etc) │
│               │                            │              │
├──────────────┴────────────────────────────┴──────────────┤
│  Timeline: scene thumbnails strip + audio track          │
│  + playhead + zoom controls                              │
└──────────────────────────────────────────────────────────┘
```

## Changes

### `src/components/ad-director/ProVideoEditor.tsx` — Full layout restructure

1. **Left sidebar** (w-56, dark bg):
   - Vertical icon strip (same tabs: Media, Music, Script, Settings, Logo) as icon buttons
   - Active tab's content renders below the icons in the sidebar
   - Top: undo/redo buttons

2. **Center canvas** (flex-1):
   - Video player with overlay support (unchanged logic)
   - Top-right: Export button (gradient, like Canva)
   - Bottom: playback controls (play/pause, skip, time display)

3. **Right panel** (w-64, collapsible):
   - New contextual properties panel:
     - **Fade**: fade-in / fade-out sliders (0-5s)
     - **Speed**: playback speed selector (0.5x–2x)
   - These map to existing `EditorSettings` fields

4. **Bottom timeline bar** (h-36, fixed at bottom of editor):
   - Scene thumbnail strip (horizontal filmstrip from clip thumbnails)
   - Audio track visualization (waveform placeholder bar)
   - Playhead indicator (white vertical line)
   - Zoom in/out + fit-to-view buttons
   - "+ Add text" and "+ Add audio" placeholder rows

5. **AI Command Bar** — moves to top of center canvas (overlaid, minimal)

### New file: `src/components/ad-director/editor/TimelineBar.tsx`
- Renders the bottom timeline with scene thumbnails, audio track row, playhead
- Props: clips, storyboard, segments, currentTime, duration, onSeek, onSelectScene

### New file: `src/components/ad-director/editor/EffectsPanel.tsx`
- Right-side panel with Fade in/out sliders and Speed selector
- Props: editorSettings, onChange

### Files Modified
- `src/components/ad-director/ProVideoEditor.tsx` — restructure from vertical to 3-panel + timeline layout
- `src/components/ad-director/editor/TimelineBar.tsx` — new component
- `src/components/ad-director/editor/EffectsPanel.tsx` — new component

