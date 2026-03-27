

# Add Audio Generation Prompt on Music Icon Click

## What happens now
Clicking the Music icon (♪) in the timeline toolbar opens the Music sidebar tab.

## What the user wants
Clicking the Music icon should open a prompt dialog. The user types a prompt (e.g. "cinematic intro music"), confirms, and new audio is generated via ElevenLabs. The new audio replaces all existing audio tracks on the video.

## Changes

### 1. Create `AudioPromptDialog.tsx`
**File:** `src/components/ad-director/editor/AudioPromptDialog.tsx`

- Dialog with:
  - Toggle: "Music" vs "Voiceover"
  - Text input for the prompt
  - Duration selector for music (15s / 30s / 60s)
  - Generate button with loading state
- On confirm: returns `{ type: "music"|"voiceover", prompt: string, duration: number }`

### 2. Add generation logic in `ProVideoEditor.tsx`
**File:** `src/components/ad-director/ProVideoEditor.tsx`

- Add state: `audioPromptOpen`, `generatingAudio`
- Add `handleGenerateAudio` function:
  - If type is "music": call `elevenlabs-music` edge function with `{ prompt, duration }`
  - If type is "voiceover": call `elevenlabs-tts` edge function with `{ text: prompt }`
  - On success: clear all existing `audioTracks`, add new track with blob URL
  - Show toast on success/failure
- Change the Music sidebar tab click: instead of `handleSetActiveTab("music")`, open the audio prompt dialog

### 3. Update Music icon behavior in timeline
**File:** `src/components/ad-director/ProVideoEditor.tsx` (lines ~1446-1453)

- Change the `onSidebarTabSelect` handler or the sidebarTabs config so clicking Music opens the prompt dialog instead of switching tabs
- Alternatively, intercept the "music" tab click in `handleSetActiveTab` to open the dialog

## Flow
1. User clicks ♪ icon → `AudioPromptDialog` opens
2. User types prompt, selects type/duration, clicks Generate
3. Loading state shown while calling ElevenLabs API
4. On success: existing audio tracks cleared, new track added
5. Toast confirms success

## Files changed
- `src/components/ad-director/editor/AudioPromptDialog.tsx` — new
- `src/components/ad-director/ProVideoEditor.tsx` — dialog state, generation handler, intercept music icon click

