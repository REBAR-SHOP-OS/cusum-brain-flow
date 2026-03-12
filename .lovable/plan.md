

# Timeline Edit Options and Per-Layer Volume Controls

## What We're Building
Add interactive edit options to each timeline layer (Video, Text, Audio) and per-layer volume sliders so users can adjust volume independently on video, voiceover, and music tracks.

## Changes

### 1. Update `AudioTrackItem` to include volume (`TimelineBar.tsx`)
- Add `volume: number` (0-1, default 1.0) to `AudioTrackItem` interface
- Add a new `videoVolume` prop to TimelineBar

### 2. Add per-layer volume controls to timeline tracks (`TimelineBar.tsx`)
- Each layer row gets a small volume icon button on the left (next to the label)
- Clicking it shows an inline mini volume slider (0-100%)
- Video row: controls the video element volume
- Audio row voiceover items: controls per-voiceover gain
- Audio row music: controls music volume
- Mute toggle via clicking the volume icon

### 3. Add right-click / click edit options on timeline items (`TimelineBar.tsx`)
- Video clips: click shows scene options (select, delete, regenerate)
- Text overlays: click to edit text, delete, change position
- Audio items: click to remove, replace, adjust volume
- Use a small popover menu on each timeline item

### 4. Wire volume changes back to ProVideoEditor (`ProVideoEditor.tsx`)
- Add `videoVolume` state (default 1.0)
- Add `onVolumeChange` callbacks for audio tracks
- Apply `videoVolume` to the `<video>` element
- Apply per-track volumes to audio playback elements
- Pass `crossfadeDuration` and volume levels to stitch export

## Files to Modify
- `src/components/ad-director/editor/TimelineBar.tsx` — add volume sliders, edit menus per layer
- `src/components/ad-director/ProVideoEditor.tsx` — wire volume state and callbacks

## UI Layout per Track Row
```text
[Vol🔊] [Label ] [==== track items with edit popover ====]
  └─ click toggles mute, hover shows slider
```

Each timeline item gets a small context menu on click with relevant actions (edit, delete, adjust volume).

