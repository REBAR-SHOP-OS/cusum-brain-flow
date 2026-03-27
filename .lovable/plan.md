

# Add Voiceover & Subtitle Icons to Timeline Toolbar

## What the user wants
Two new toolbar icons in the timeline bar:
1. **Voiceover (Mic icon)**: User types text → TTS generates speech → audio replaces existing audio on video
2. **Subtitle (Subtitles/Captions icon)**: User types text → appears as subtitle below the video

## Changes

### 1. Add two new toolbar icons to the sidebarTabs in `ProVideoEditor.tsx`

Add after the existing "music" tab:
- `{ id: "voiceover", label: "Voiceover", icon: <Mic /> }` — opens a dialog for typing text that gets read aloud via ElevenLabs TTS
- `{ id: "subtitle", label: "Subtitle", icon: <Captions /> }` — opens a dialog for typing subtitle text

Update `EditorTab` type to include `"voiceover"` and `"subtitle"`.

### 2. Intercept "voiceover" tab click in `handleSetActiveTab`

Similar to how "music" opens the `AudioPromptDialog`, clicking "voiceover" will open a new `VoiceoverDialog` — a simple dialog where:
- User types text (textarea)
- Selects a voice (dropdown with ElevenLabs voice options)
- Clicks "Generate"
- Calls `elevenlabs-tts` edge function
- Replaces existing audio tracks with the generated voiceover

### 3. Create `VoiceoverDialog.tsx`

**File:** `src/components/ad-director/editor/VoiceoverDialog.tsx`

- Textarea for the script/text
- Voice selector dropdown (Roger, Sarah, Laura, etc.)
- Speed slider (0.7–1.2)
- Generate button with loading state
- On confirm: returns `{ text, voiceId, speed }`

### 4. Intercept "subtitle" tab click in `handleSetActiveTab`

Opens a new `SubtitleDialog` — simple dialog where:
- User types subtitle text
- Clicks "Add"
- Adds a text overlay at bottom-center of the current scene (similar to existing TextOverlayDialog but positioned specifically as subtitle)

### 5. Create `SubtitleDialog.tsx`

**File:** `src/components/ad-director/editor/SubtitleDialog.tsx`

- Textarea for subtitle text
- Adds overlay with `position: { x: 25, y: 85 }` (bottom center)
- Styled as subtitle (smaller text, semi-transparent background)

### 6. Wire dialogs in `ProVideoEditor.tsx`

- Add `voiceoverDialogOpen` and `subtitleDialogOpen` states
- Add `handleGenerateVoiceover` — calls `elevenlabs-tts`, replaces audio tracks
- Add `handleAddSubtitle` — adds text overlay at bottom position
- Render both new dialogs alongside existing ones

## Files changed
- `src/components/ad-director/ProVideoEditor.tsx` — new tab entries, intercept handlers, dialog states, generation logic
- `src/components/ad-director/editor/VoiceoverDialog.tsx` — new
- `src/components/ad-director/editor/SubtitleDialog.tsx` — new

