

# Add "Edit Text & Voice" Button to Toolbar

## What
A new toolbar icon (e.g., `MessageSquareText`) that opens a dialog showing the current scene's voiceover/subtitle text. When the user edits the text and confirms, the system will:
1. Update the subtitle overlays on the video with the new text
2. Regenerate the voiceover audio via ElevenLabs TTS
3. Both new text and new audio apply to the current scene

## Changes

### 1. New file: `src/components/ad-director/editor/TextVoiceDialog.tsx`
- Dialog pre-filled with the current scene's voiceover text (from `storyboard[scene].voiceover` or segment text)
- Voice selector dropdown (same voices as VoiceoverDialog)
- Speed slider (0.7–1.2)
- "Generate" button that returns `{ text, voiceId, speed, sceneId }`
- Shows loading state during generation

### 2. `src/components/ad-director/ProVideoEditor.tsx`

**New state:**
- `textVoiceDialogOpen` (boolean)

**New handler** `handleTextVoiceGenerate`:
- Takes `{ text, voiceId, speed, sceneId }`
- Updates `storyboard` scene's `.voiceover` field with new text (via `onUpdateStoryboard`)
- Calls ElevenLabs TTS to generate audio from the new text
- Updates `audioTracks` with the new voiceover audio for that scene
- Rebuilds timed subtitle overlays for that scene using `buildTimedOverlays`
- Shows toast on success/failure

**Toolbar (sidebarTabs ~line 1574):**
- Add new entry: `{ id: "text-voice", label: "Text+Voice", icon: <MessageSquareText className="w-3.5 h-3.5" /> }`

**Tab handler (~line 194):**
- When `"text-voice"` tab clicked, open the `TextVoiceDialog`

**Dialog render (~line 1665):**
- Add `<TextVoiceDialog>` with current scene's voiceover text as initial value

## Files changed
- `src/components/ad-director/editor/TextVoiceDialog.tsx` — new
- `src/components/ad-director/ProVideoEditor.tsx` — state, handler, toolbar icon, dialog

