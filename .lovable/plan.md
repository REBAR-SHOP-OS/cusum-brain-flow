

# Remove Automatic Music Generation

## Problem
When voiceovers are generated, the system automatically generates background music as "Phase 2" (lines 1459-1498 in `ProVideoEditor.tsx`). The user wants music to only be generated when explicitly requested via the "Auto Music" button.

## Change

### `src/components/ad-director/ProVideoEditor.tsx`
- **Remove Phase 2** (lines 1459-1498): Delete the automatic music generation block inside the voiceover generation function. Music should only come from the explicit `generateBackgroundMusic` function triggered by the "Auto Music" button.
- Update the Phase 3 toast to say "Voiceover complete" instead of "Generation complete" with audio & music count.

This is a single-file, surgical removal. The "Auto Music" button (line 1825-1834) remains fully functional for when the user explicitly wants music.

