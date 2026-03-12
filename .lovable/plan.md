

## Activate Image & Audio Modes in Video Studio

The Image and Audio mode icons are currently disabled placeholders. Both backend edge functions already exist (`generate-image` for GPT Image/DALL-E, `elevenlabs-music` for music/SFX). This plan activates them as full modes in the Studio.

### Architecture

Add a `mediaType` state (`"video" | "image" | "audio"`) to `VideoStudioContent.tsx`. The prompt bar icons become clickable toggles. Each mode adjusts the UI (hiding irrelevant controls) and routes to the correct backend.

### Changes

**1. `VideoStudioPromptBar.tsx`**
- Accept `mediaType` and `onMediaTypeChange` props
- Make Image and Audio icon buttons active/clickable (remove `cursor-default`, add click handlers)
- Conditionally hide duration/mode pills for image mode (images don't need duration or Fast/Balanced/Premium)
- For audio mode: hide aspect ratio, show duration as audio length (5s/15s/30s), hide mode selector, show music/sfx toggle
- Update placeholder text per mode: "Describe the image..." / "Describe the sound or music..." / "Describe the video..."

**2. `VideoStudioContent.tsx`**
- Add `mediaType` state, pass to prompt bar
- Image mode generate flow: call `generate-image` edge function with the prompt + aspect ratio mapped to size, display result as an image card with download button
- Audio mode generate flow: call `elevenlabs-music` edge function with prompt + duration + type (music/sfx), display result as an audio player with download
- Reuse credit system: image = 1 credit, audio = varies by duration
- Keep video generation flow unchanged
- Show appropriate results UI per mode (image preview vs audio player vs video player)

**3. Props additions to `VideoStudioPromptBar`**
```typescript
mediaType: "video" | "image" | "audio";
onMediaTypeChange: (t: "video" | "image" | "audio") => void;
audioType?: "music" | "sfx";
onAudioTypeChange?: (t: "music" | "sfx") => void;
```

### UI Behavior per Mode

| Control | Video | Image | Audio |
|---------|-------|-------|-------|
| Mode (Fast/Balanced/Premium) | Yes | No | No |
| Aspect Ratio | Yes | Yes (mapped to size) | No |
| Duration | Yes | No | Yes (5s/15s/30s) |
| Ref Image | Yes | Yes (for editing) | No |
| Music/SFX toggle | No | No | Yes |

### No new edge functions needed — existing `generate-image` and `elevenlabs-music` are reused directly.

