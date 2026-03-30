

# Fix Delete Scene — Allow Deleting Selected Card

## Problem
Clicking the trash icon (🗑️) shows "Cannot delete — At least one scene required" even when there are multiple scenes, or prevents deletion of the last scene. The user expects the selected card to be deleted when clicking this icon.

## Root Cause
In `ProVideoEditor.tsx` line 1129, there's a guard: `if (storyboard.length <= 1)` that blocks deletion. This may be triggering incorrectly due to stale closure, or the user wants to delete even the last scene.

## Changes

### `src/components/ad-director/ProVideoEditor.tsx`
- **Remove the minimum-1 guard** from `handleDeleteScene`
- When deleting the last scene, reset to an empty state or allow the timeline to be empty
- Also clean up associated audio tracks and overlays for the deleted scene (voiceover, text, music tied to that scene)
- Adjust `selectedSceneIndex` after deletion: if all scenes deleted, set to -1 or 0

### `src/components/ad-director/editor/TimelineBar.tsx`
- Handle the case where `storyboard` is empty gracefully (show empty state or placeholder)

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — remove minimum scene guard, clean up associated tracks on delete
- `src/components/ad-director/editor/TimelineBar.tsx` — handle empty storyboard gracefully

