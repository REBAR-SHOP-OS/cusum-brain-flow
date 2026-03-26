

# Make Music Tab Prompt-Driven with AI Generation

## What
Redesign the Music tab so the **primary interface is a text prompt** for AI music generation. The stock track list becomes secondary. The existing ElevenLabs music generation backend already works — this is a UI restructuring.

Note: Gemini models don't generate audio files. The existing ElevenLabs music API (`elevenlabs-music` edge function) is already configured and is the correct backend for this. The change is purely in MusicTab UI layout.

## Changes

### `src/components/ad-director/editor/MusicTab.tsx`
Restructure the layout:

1. **Top section — AI Music Generator (always visible)**:
   - Large text input/textarea with placeholder like "توصیف موسیقی مورد نظر..." / "Describe your music..."
   - Duration selector (15s, 30s, 60s) as small chips
   - Type selector chips: "Music" / "Sound Effect"
   - Generate button (full-width, prominent)
   - Loading state with spinner during generation

2. **Bottom section — Generated & Uploaded tracks**:
   - Show AI-generated and uploaded tracks (remove the 12 fake stock tracks that have no actual audio URLs)
   - Keep upload button (+) for user audio files
   - Keep play/pause, waveform visualization, and "Use" button
   - Keep volume slider and search

3. **Remove**:
   - The sparkles toggle button (prompt is now always visible)
   - The `showPromptInput` state toggle
   - The 12 `STOCK_TRACKS` entries (they have no real audio and just show "Generate or upload a track to play it")
   - The filter dropdown (All audio / Music / Sound effects) — replaced by type chips in the generator

| File | Change |
|---|---|
| `MusicTab.tsx` | Restructure: prompt-first UI, remove fake stock tracks, add duration/type selectors |

