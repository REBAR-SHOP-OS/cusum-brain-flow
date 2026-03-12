

# Expand Editor Sidebar to InVideo-Style Layout

## What Changes
Replace the current 5-tab sidebar (Media, Music, Script, Settings, Logo) with the full InVideo-style sidebar matching the reference image:

| Tab | Icon | Content |
|-----|------|---------|
| My Media | FolderOpen | Existing MediaTab (clips + scenes) |
| Record & Create | Video | Webcam/screen record placeholders + AI generate button |
| Text | Type | Text style presets + "Add Text Overlay" button (opens TextOverlayDialog) |
| Music | Music | Existing MusicTab (with search bar + waveform cards like reference) |
| Stock Video | Film | Search input + placeholder grid of stock clips |
| Stock Images | ImagePlus | Search input + placeholder grid of stock images |
| Templates | LayoutTemplate | Grid of scene template preset cards |
| Graphics | Shapes | Sticker/shape/emoji category grid |
| Transitions | ArrowRightLeft | Transition picker (Cut, Fade, Wipe, Slide, Zoom) updates editorSettings |
| Brand Kit | Palette | Brand colors, fonts, logo from existing brand prop |

Script, Settings, and Logo move into sub-sections or remain accessible (Script under the timeline, Settings via gear in top bar, Logo inside Brand Kit).

## Files

### New tab components (`src/components/ad-director/editor/`)
- `RecordTab.tsx` — Camera/screen record UI + AI generate
- `TextTab.tsx` — Text presets + add overlay button
- `StockVideoTab.tsx` — Search + placeholder grid
- `StockImagesTab.tsx` — Search + placeholder grid
- `TemplatesTab.tsx` — Template preset cards
- `GraphicsTab.tsx` — Shape/sticker categories
- `TransitionsTab.tsx` — Transition type selector, calls `onSelectTransition`
- `BrandKitTab.tsx` — Brand colors/fonts/logo editor using existing `brand` prop + LogoTab

### Modified: `src/components/ad-director/ProVideoEditor.tsx`
- Update `EditorTab` type to include all 10 tabs
- Update `TABS` array with new icons and labels (matching InVideo order)
- Import and render new tab components in the sidebar content area
- Move Script/Settings to secondary access (Script stays in TABS but lower priority; Settings accessible via top bar gear icon)
- Wire Text tab to open `TextOverlayDialog`
- Wire Transitions tab to update `editorSettings.transitionPreset`
- Wire Brand Kit to show brand + logo controls

