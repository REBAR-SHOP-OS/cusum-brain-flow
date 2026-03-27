

# Remove Text & Audio Track Rows from Timeline

## What
Remove the "Text" and "Audio" track rows from the timeline bar in the video editor. These are the two horizontal bars below the video track (amber for Text, blue/purple for Audio).

## Changes

### File: `src/components/ad-director/editor/TimelineBar.tsx`
- Remove the **Text track** block (lines ~521-628) — the entire `{/* ─── Text track ─── */}` section including the VolumeControl, text overlays rendering, and "Add text" button.
- Remove the **Audio track** block (lines ~630-750+) — the entire `{/* ─── Audio track ─── */}` section including the VolumeControl, music/voiceover track rendering, and associated popovers.

The Video track row and all other timeline controls (playhead, toolbar icons, zoom) remain unchanged.

## Files changed
- `src/components/ad-director/editor/TimelineBar.tsx` — remove ~200 lines (Text + Audio track rows)

