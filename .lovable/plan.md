

# Add Inline Voiceover Text Editing in Audio Popover

## Problem
Currently, "Edit Text" in the audio popover just switches to the Script tab. The user wants to edit the voiceover text **directly in the audio popover** and then re-record based on the new text.

## Solution
Replace the "Edit Text" button with an inline `Textarea` showing the current voiceover text. The user edits it, then clicks "Re-record" which uses the edited text.

### Changes

#### 1. `src/components/ad-director/editor/TimelineBar.tsx`
- Add local state `editingVoiceoverText: Record<string, string>` to track edited text per scene
- Replace the "Edit Text" button with a small `Textarea` pre-filled with the scene's voiceover text
- When the popover opens, initialize the textarea with current voiceover text from the scene
- Pass the edited text to `onReRecordVoiceover` as a second parameter
- Add a new callback prop: `onUpdateVoiceoverText?: (sceneId: string, text: string) => void` to persist the text change

#### 2. `src/components/ad-director/ProVideoEditor.tsx`
- Update `handleReRecordVoiceover` to accept an optional `customText` parameter — if provided, use it instead of `scene.voiceover`
- Before re-recording, update the storyboard scene's voiceover field via `onUpdateStoryboard`
- Add `handleUpdateVoiceoverText` callback that updates the storyboard voiceover and regenerates subtitle overlays
- Pass `onUpdateVoiceoverText` to `TimelineBar`

```text
Current popover:
  [Volume slider]
  [Edit Text] → switches tab
  [Re-record] → uses existing text

New popover:
  [Volume slider]
  [Textarea with voiceover text - editable]
  [Save Text] → persists text + updates subtitles
  [Re-record] → TTS with current textarea text
```

| File | Change |
|---|---|
| `TimelineBar.tsx` | Replace "Edit Text" button with inline Textarea + Save, pass edited text to re-record |
| `ProVideoEditor.tsx` | Add `handleUpdateVoiceoverText` to update storyboard + subtitles, update re-record to use custom text |

