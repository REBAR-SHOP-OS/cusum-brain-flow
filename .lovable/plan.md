

# Media Tab — Upload Only

## Problem
The Media sidebar tab currently shows three buttons: Upload, Stock, and Generate. The user wants this icon/tab to only provide video upload functionality.

## Changes

### `src/components/ad-director/editor/MediaTab.tsx`
- Remove the "Stock" button and "Generate" button from the main view (lines ~175-189)
- Keep only the "Upload" button
- Remove the "Add / Replace media" label — simplify to just the upload button
- Keep the `handleFileChange` logic (which creates a new scene card via `onAddSceneWithMedia`)

### Result
Clicking the media tab icon shows only an Upload button. Uploading a video creates a new scene card in the timeline as previously implemented.

