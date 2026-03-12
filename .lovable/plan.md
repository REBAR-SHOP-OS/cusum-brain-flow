

# InVideo-Style Professional Video Editor

## What We're Building

A complete redesign of the Video Editor into an InVideo-style professional editing interface with:
- Full-screen video player with AI command bar below it
- Tabbed side panel: **Media**, **Music**, **Script**, **Settings**, **Logo**
- Per-clip media properties (trim, position, zoom, rotation, color)
- Audio & SFX management per clip
- Chapter-based script editing with stock media and voiceover per paragraph
- Global settings: overlay preset, transition preset, subtitle preset, sticker preset, text preset, SFX/media volume sliders
- Logo panel: position (X/Y), zoom, delete/replace, live preview

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│  Video Player (full width, aspect-video)                │
│  ┌─────────────────────────────────────────────────────┐│
│  │  <video> with custom controls + timeline            ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  AI Command Bar: "Give me a command to edit..."     ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  Tabbed Panel                                       ││
│  │  [Media] [Music] [Script] [Settings] [Logo]         ││
│  │  ───────────────────────────────────────────        ││
│  │  (content based on active tab)                      ││
│  └─────────────────────────────────────────────────────┘│
│  [Edit ▼]  [Download ▼]   bottom action bar            │
└─────────────────────────────────────────────────────────┘
```

## Files

### 1. New: `src/components/ad-director/ProVideoEditor.tsx`
The main editor shell — replaces the current `VideoEditor` usage. Contains:
- Video player with custom play/pause, volume, speed, time display, fullscreen
- AI command input bar with send button and settings toggle
- Tab navigation: Media, Music, Script, Settings, Logo
- Renders the active tab panel component
- Bottom action bar: Edit dropdown, Download dropdown

### 2. New: `src/components/ad-director/editor/MediaTab.tsx`
- Shows chapter clips as thumbnail cards with duration badges
- Script subtitle preview strip below thumbnails
- "Replace media" section: Uploaded media, Stock media, Generative Media buttons
- Media info card: chapter/media name, duration, transition type, audio volume
- "Media properties" drill-down view with:
  - Duration display, trim toggle + from/to inputs
  - Center point (X/Y), Position (X/Y), Zoom & Rotation controls
  - Color hex picker
  - Audio & SFX sub-tab: Upload audio, Stock SFX, Generate SFX buttons
  - Apply / Reset buttons

### 3. New: `src/components/ad-director/editor/MusicTab.tsx`
- Music track cards (Generated Music, uploaded, stock)
- Chapter selector pills
- Replace music: Uploaded music, Stock music buttons
- Music info: name, duration, waveform preview placeholder
- "Music properties" drill-down

### 4. New: `src/components/ad-director/editor/ScriptTab.tsx`
- Chapter sections with editable paragraph blocks
- Each paragraph: text area + side actions (+ Add, Stock media, Narrator voice-over)
- Inline editing with save

### 5. New: `src/components/ad-director/editor/SettingsTab.tsx`
- Overlay Preset dropdown (None, ...)
- Transition Preset dropdown (None, ...)
- Subtitle Preset dropdown (Standard, ...)
- Sticker Preset dropdown (None, ...)
- Text Preset dropdown (Minimal, ...)
- SFX Master Volume slider (0-100%)
- Media Audio Master Volume slider (0-100%)
- Reset + Save changes buttons

### 6. New: `src/components/ad-director/editor/LogoTab.tsx`
- Position: X/Y number inputs
- Zoom: percentage input
- Logo preview card with current logo image
- Actions: Delete logo (red), Replace Logo buttons
- Save changes button

### 7. Modified: `src/components/ad-director/AdDirectorContent.tsx`
- In the "preview" step, replace `FinalPreview` with `ProVideoEditor` when a final video exists or clips are ready
- Pass clips, storyboard, segments, brand, and all settings as props

### 8. Modified: `src/types/adDirector.ts`
- Add `EditorSettings` interface for overlay/transition/subtitle/sticker/text presets and volume levels
- Add `LogoSettings` interface for position, zoom

## Visual Standards
- Dark theme matching InVideo: `bg-[#1a1a2e]` style cards, `border-border/30` subtle borders
- Tab underline indicator (active tab gets bottom border highlight)
- Rounded input fields with dark backgrounds
- Red accent for destructive actions (Delete logo)
- Blue/purple accent for primary save actions
- Compact, information-dense layout

