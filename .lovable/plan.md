
# Add Fullscreen / Minimize Toggle to Pipeline AI Sheet (Blitz)

## What Changes
Add two buttons to the Blitz/Gauge sheet header: **Fullscreen** (expand to fill the entire viewport) and **Minimize** (collapse back to the default side-sheet width).

## Technical Approach

### File: `src/components/pipeline/PipelineAISheet.tsx`

1. **New state**: `isFullscreen` boolean (default `false`)
2. **Header buttons** (placed next to the existing close X):
   - `Maximize2` icon -- toggles fullscreen ON
   - `Minimize2` icon -- toggles fullscreen OFF
   - Only the relevant button shows based on current state
3. **SheetContent class changes**:
   - Default: `w-full sm:max-w-lg` (current behavior)
   - Fullscreen: `w-full sm:max-w-full h-full` -- fills the entire viewport
4. **Reset on close**: When `open` becomes `false`, reset `isFullscreen` to `false`

### Visual Placement
The fullscreen/minimize button will sit in the header row, right-aligned next to the sheet's built-in close button. Uses `lucide-react` icons `Maximize2` and `Minimize2`.

### No other files touched
Surgical change -- only `PipelineAISheet.tsx` is modified. No layout, sidebar, or other component changes.
