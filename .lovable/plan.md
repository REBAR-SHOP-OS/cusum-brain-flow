

# Music Icon — Remove Voiceover Options

## Problem
The music icon (🎵) in the toolbar opens the `AudioPromptDialog` which has both "موسیقی" (Music) and "صداگذاری" (Voiceover) radio options. The user wants this icon to only handle music generation — voiceover options should be removed from this dialog.

## Changes

### 1. `src/components/ad-director/editor/AudioPromptDialog.tsx`
- Remove the "نوع" (Type) radio group that toggles between music/voiceover
- Hardcode `type` to `"music"` — remove the `useState` for type
- Remove the `Mic` icon import and voiceover-related radio option
- Always show the duration toggle (since it's always music now)
- Update placeholder to always show music prompt text
- In the Upload tab, remove the voiceover radio option — hardcode `uploadKind` to `"music"`

### 2. `src/components/ad-director/editor/AudioPromptDialog.tsx` — Upload tab
- Remove the "نوع فایل" radio group (music/voiceover toggle)
- Hardcode `uploadKind` to `"music"`

### Result
The music icon dialog only shows music generation and music file upload — no voiceover options. The separate "Voice" tab (Mic icon) in the toolbar still handles voiceover independently.

## Files Changed
- `src/components/ad-director/editor/AudioPromptDialog.tsx` — remove voiceover type options from both Generate and Upload tabs

