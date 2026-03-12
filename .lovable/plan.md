

# Upgrade Timeline Scene Context Menu with Full Editing Options

## Current State
The timeline scene popover only has 3 options: Select, Regenerate, Delete. The Text track popover only has Edit Text and Delete. The Audio track popover only has volume slider and Remove.

## What We'll Build
Expand all three track popovers with comprehensive editing options:

### Video Track Scene Popover — add these options:
- **Trim** — shrink the scene (adjust start/end time by modifying segment timing)
- **Stretch** — extend scene duration
- **Split** — divide scene into two at midpoint
- **Edit Prompt** — inline edit the AI generation prompt
- **Edit Voiceover Text** — quick-edit the script segment text for this scene
- **Duplicate** — clone the scene
- **Move Left / Move Right** — reorder scenes
- **Mute Scene** — toggle scene audio on/off
- Existing: Select, Regenerate, Delete

### Text Track Popover — add:
- **Edit Text** (existing)
- **Move** — reposition overlay (top/center/bottom presets)
- **Resize** — small/medium/large presets
- **Toggle Animation** — enable/disable fade-in animation
- **Delete** (existing)

### Audio Track Voiceover Popover — add:
- **Edit Text** — edit the voiceover script text and regenerate TTS
- **Re-record** — regenerate voiceover with same text
- Volume slider (existing)
- **Remove** (existing)

## Files to Modify

### `src/components/ad-director/editor/TimelineBar.tsx`
- Add new callback props: `onTrimScene`, `onStretchScene`, `onSplitScene`, `onDuplicateScene`, `onMoveScene`, `onEditPrompt`, `onEditVoiceover`, `onMuteScene`, `onEditOverlayPosition`, `onToggleOverlayAnimation`, `onReRecordVoiceover`
- Expand video track popover with all new menu items (icons: Scissors, Expand, Split, Edit3, Mic, Copy, ArrowLeftRight, VolumeX)
- Expand text track popover with Move/Resize/Animation options
- Expand voiceover popover with Edit Text and Re-record buttons
- Increase popover width from `w-36` to `w-44` for video track

### `src/components/ad-director/ProVideoEditor.tsx`
- Implement handler functions for each new action:
  - `handleTrimScene` — open a dialog or adjust segment endTime by -1s
  - `handleStretchScene` — increase segment endTime by +1s
  - `handleSplitScene` — split storyboard scene + segment at midpoint
  - `handleDuplicateScene` — clone scene and segment, insert after current
  - `handleMoveScene` — swap scene position in storyboard array
  - `handleEditPrompt` — set active tab to media + select scene (already works via select)
  - `handleEditVoiceover` — switch to script tab for editing
  - `handleReRecordVoiceover` — regenerate TTS for a single scene
- Wire all handlers through TimelineBar props
- Add `onDeleteScene` handler (currently missing from props passed to TimelineBar)

