

# Move Chapters from Sidebar to Timeline Video Track

## What
The user wants the chapter thumbnails (currently in MediaTab sidebar under "Chapters") to be displayed inside the timeline's video track area instead. The video track currently shows colored blocks — it should show the scene thumbnails with labels directly in the timeline.

## Current State
- **MediaTab** (left sidebar): Shows chapter list with thumbnails, status badges, scene labels, and duration
- **TimelineBar video track**: Shows colored blocks with tiny labels (`S1`, `S2`...) and extracted thumbnails — but appears empty when no clips are generated yet

## Problem
The chapter previews are hidden in the sidebar while the timeline video track (the main visual area) looks empty. The user wants the visual chapter cards to live in the timeline.

## Changes

### `src/components/ad-director/editor/TimelineBar.tsx`
**Enhance the video track scene blocks** to show richer content similar to MediaTab chapters:
- Increase video track height from `h-12` to `h-20` to fit more info
- Show scene thumbnail (already implemented via `useVideoThumbnails`)
- Show scene objective/label text (truncated)
- Show segment text preview (first ~30 chars)
- Show status badge (done/generating/idle) 
- Show duration badge

### `src/components/ad-director/editor/MediaTab.tsx`
**Remove the "Chapters" section** (the scrollable list of scene cards). Keep only the "Replace media" buttons (Upload/Stock/Generate) since those are still useful actions.

| File | Change |
|---|---|
| `TimelineBar.tsx` | Increase video track height, add scene objective, segment text preview, status & duration badges to each scene block |
| `MediaTab.tsx` | Remove chapter thumbnail list, keep only "Replace media" action buttons |

