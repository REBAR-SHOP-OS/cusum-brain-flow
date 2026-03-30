

# Add "Regenerate Audio + Text" Button to Timeline

## What It Does
A single generate/regenerate button on the timeline toolbar that:
1. Calls `generateAllVoiceovers()` — generates TTS audio for all segments (replaces old voiceover tracks)
2. Text overlays auto-regenerate via existing `useEffect` when `voiceoverDurations` change
3. Old audio (green) and text (blue/pink) tracks are replaced with fresh ones

## Changes

### File 1: `src/components/ad-director/editor/TimelineBar.tsx`

**Add props:**
- `onRegenerateAll?: () => void` — triggers full voiceover + text regeneration
- `isRegeneratingAll?: boolean` — loading state

**Add to toolbar** (after the delete button, before the spacer `<div className="flex-1" />`):
A Sparkles icon button labeled "Generate" that calls `onRegenerateAll`. Shows a spinning Loader2 when `isRegeneratingAll` is true.

### File 2: `src/components/ad-director/ProVideoEditor.tsx`

**Pass props to TimelineBar:**
- `onRegenerateAll={generateAllVoiceovers}`
- `isRegeneratingAll={generatingVoiceovers}`

The existing `generateAllVoiceovers` already:
- Clears old voiceover tracks and replaces with new ones
- Updates `voiceoverDurations` which triggers text overlay regeneration via `useEffect`

No new logic needed — just wiring the button to the existing function.

## Result
User clicks the Sparkles "Generate" button → all voiceover audio regenerates → text overlays auto-sync → old tracks replaced with new ones.
