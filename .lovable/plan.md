

# Add Visible Regenerate Button on Scene Cards

## Problem
The current regenerate button (small RefreshCw icon next to the custom prompt input) is not clearly visible. The user wants a prominent regenerate icon on each scene card that re-generates the video using the **original scene prompt** from the storyboard.

## Current Behavior
- Line 563: `handleRegenerateScene(clip.sceneId, scenePrompts[clip.sceneId])` — uses custom prompt if filled, falls back to `scene.prompt` (line 296)
- The button is a tiny 7×7 ghost icon, easy to miss

## Solution
Add a visible regenerate overlay button **on the scene card thumbnail** (similar to the play button overlay) that calls `handleRegenerateScene(clip.sceneId)` with **no custom prompt** — forcing it to use the original `scene.prompt`.

### `src/components/ad-director/AdDirectorContent.tsx`

Add a regenerate button overlay on each completed scene card (next to the play overlay), visible on hover:

```text
Location: Inside the group-hover overlay area (around lines 521-525)

Add a RefreshCw button in the top-right corner of the scene card:
- Positioned absolute top-2 right-2
- Small rounded bg-black/50 button
- On click: handleRegenerateScene(clip.sceneId) — no custom prompt, uses original scene prompt
- stopPropagation to prevent triggering the card click (video selection)
- Disabled when clip.status === "generating"
- Shows spinning animation when generating
```

Also add the same regenerate button on **failed** scene cards (line 531-534) so the user can retry failed generations.

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Add hover-visible regenerate button overlay on completed and failed scene card thumbnails |

