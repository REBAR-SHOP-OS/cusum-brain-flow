

# Remove AI Edit Scene Bar from Video Editor

## Problem
The user wants the "AI: Edit this scene..." command bar (floating at the top of the video editor canvas) removed.

## Fix
**File: `src/components/ad-director/ProVideoEditor.tsx`** (lines 1249-1273)

Remove the entire `{/* AI Command Bar — floating at top */}` block — the `div` containing the Sparkles icon, Input, and Send button.

No other files affected. The `aiCommand`, `aiProcessing`, `handleAiSubmit` state/handlers can remain (unused code cleanup is optional and low-risk).

