

# Display Generated Scene Clips as Thumbnail Cards in Ad Director

## What
In the "result" view of the Ad Director, replace the single large video preview (or "not available" message) with a horizontal scrollable row of scene thumbnail cards — one card per generated clip. Each card shows the video thumbnail with hover-to-play, scene number, and status. The final stitched video (if available) shows separately below or as a "Full Video" card.

## How

### Update `AdDirectorContent.tsx` — Result section (lines 313-326)

Replace the single video preview block with a **scene clips gallery**:

- Render a horizontal scrollable row of cards from the `clips` array (joined with `storyboard` for scene labels)
- Each card:
  - Shows a `<video>` element with `preload="metadata"`, hover-to-play behavior
  - Displays scene number/label overlay (e.g. "Scene 1 — Hook")
  - Shows status indicator (spinner for generating, checkmark for completed, error for failed)
  - Completed clips: clickable to play in a larger preview area above
- Below the scene cards row, keep the existing final video player for the stitched result
- If no final video but clips exist, clicking a scene card plays it in the main preview area

### Visual Layout (matching user's drawing)
```text
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Scene 1│ │ Scene 2│ │ Scene 3│ │ Scene 4│  ← horizontal scroll
│  video │ │  video │ │  video │ │  video │
│  thumb │ │  thumb │ │  thumb │ │  thumb │
└────────┘ └────────┘ └────────┘ └────────┘

      [ Approve & Download ]  [ Edit Video ]
```

### Implementation Details
- Add `selectedPreviewUrl` state to track which clip is shown in the main player
- Scene cards use the same hover-play pattern from `VideoLibrary.tsx`
- Cards grid: `flex overflow-x-auto gap-3` with `min-w-[200px] aspect-video` per card
- Generating scenes show a pulsing skeleton with spinner
- Failed scenes show retry indicator

## Files Changed

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` | Replace single video preview with scene clips gallery in result view |

