

# Add Sidebar + Wire Non-Functional Buttons in AI Video Director

## Overview
Add an InVideo-style collapsible sidebar to the Ad Director page and wire up all placeholder/non-functional buttons across the editor tabs (Music, Media, Script, Logo, AI Command Bar).

## Current Issues (Audit)

### Non-Functional Buttons
1. **MusicTab** — "Upload", "Stock", "AI Generate" buttons do nothing; Play button toggles state but plays no audio
2. **MediaTab** — "Upload", "Stock", "Generate" (replace media) buttons do nothing; Media Properties "Apply"/"Reset" do nothing; Audio section "Upload", "Stock SFX", "Generate" do nothing
3. **ScriptTab** — "Add", "Stock media", "Voiceover" buttons do nothing; `onUpdateSegment` is never passed from ProVideoEditor
4. **SettingsTab** — "Save changes" and "Reset" do nothing
5. **LogoTab** — "Delete" and "Replace" handlers are never passed; "Save changes" does nothing
6. **ProVideoEditor AI Command Bar** — `handleAiSubmit` has a `TODO` comment and does nothing
7. **ProVideoEditor Edit dropdown** — Undo/Redo/Reset do nothing

## Plan

### 1. Add Sidebar to AdDirector Page
Create `src/components/ad-director/AdDirectorSidebar.tsx` — a collapsible dark sidebar inspired by the InVideo reference screenshot.

Sections:
- **Home** — link back to `/ad-director` (script step)
- **Media Library** — opens media tab in editor
- **Generative Picks** — link to `/video-studio`
- **Plugins** section: Text to clip, Text to image, Photo to clip, Preset library (link to relevant tools)
- **History** section: Show recent `ad_projects` from the existing `useAdProjectHistory` hook, with "Show all" link

The sidebar will be rendered inside `AdDirector.tsx`, wrapping the content in a flex layout. It will be collapsible via a toggle button.

### 2. Wire MusicTab — AI Generate
- Add state + handler to call the existing `elevenlabs-music` edge function
- On click "AI Generate": prompt user for a music description (simple input dialog), call the edge function, receive audio blob, create object URL, set as playable track
- Wire the Play/Pause button to an `<audio>` element ref
- "Upload": open file picker for audio files, create object URL
- "Stock": show toast "Stock library coming soon" (no stock API exists)

### 3. Wire AI Command Bar in ProVideoEditor
- Connect `handleAiSubmit` to the existing `edit-video-prompt` edge function
- Pass the current scene's engineered prompt + the user's command as `editDetail`
- On success, update the storyboard prompt for the selected scene and show a toast

### 4. Wire MediaTab Actions
- "Generate" button under "Replace media": call `generateScene` for the selected scene (need to pass this handler down from `AdDirectorContent`)
- "Upload" under "Replace media": open file picker, upload to Supabase storage, update clip URL
- "Apply" in Media Properties: apply transform values to the clip (store in local editor state — these are CSS transforms on the video canvas)
- "Reset": reset all property values to defaults

### 5. Wire ScriptTab
- Pass `onUpdateSegment` from `ProVideoEditor` → `ScriptTab` (currently defined in ScriptTab but never wired)
- Wire it to update `segments` state in `AdDirectorContent` (need to lift the handler)
- "Voiceover" button: call `elevenlabs-tts` edge function for the segment text, play preview

### 6. Wire SettingsTab & LogoTab
- "Save changes" in SettingsTab: already updates state via `onChange`, just show toast confirmation
- "Reset" in SettingsTab: reset to `DEFAULT_EDITOR_SETTINGS`
- LogoTab "Delete": clear `brand.logoUrl`, "Replace": open file picker + upload to `brand-assets` bucket
- LogoTab "Save changes": show toast (state already managed via `onChange`)

### 7. Wire Edit Dropdown (Undo/Redo/Reset)
- Implement a simple history stack for storyboard state changes (push on prompt edit, scene regenerate)
- Undo/Redo navigate the stack; Reset clears to initial storyboard

## Files Modified
- `src/pages/AdDirector.tsx` — wrap with sidebar layout
- **New**: `src/components/ad-director/AdDirectorSidebar.tsx` — sidebar component
- `src/components/ad-director/AdDirectorContent.tsx` — expose segment update handler, pass generate/upload handlers to ProVideoEditor
- `src/components/ad-director/ProVideoEditor.tsx` — wire AI command bar, pass handlers to tabs, add undo/redo state
- `src/components/ad-director/editor/MusicTab.tsx` — wire AI generate, upload, play/pause with audio element
- `src/components/ad-director/editor/MediaTab.tsx` — wire replace media buttons
- `src/components/ad-director/editor/ScriptTab.tsx` — wire voiceover preview
- `src/components/ad-director/editor/SettingsTab.tsx` — wire save/reset
- `src/components/ad-director/editor/LogoTab.tsx` — wire delete/replace/save

## Technical Notes
- Music generation uses the existing `elevenlabs-music` edge function (already deployed)
- TTS uses the existing `elevenlabs-tts` edge function
- AI command bar uses the existing `edit-video-prompt` edge function
- File uploads use the existing `brand-assets` and `generated-videos` Supabase storage buckets
- No new database tables or edge functions needed

