

# Add Sidebar Panel to Video Editor for Tab Icons

## Problem
The timeline toolbar has 6 clickable icons (Media, Text, Music, Script, Brand Kit, Card Editor) that highlight when clicked but don't open any panel. The `activeTab` state updates but no corresponding UI panel is rendered.

## Solution
Add a collapsible right sidebar panel in the editor's main area that renders the appropriate tab content when an icon is clicked. Clicking the same icon again closes the panel (toggle behavior).

### `src/components/ad-director/ProVideoEditor.tsx`

**1. Add toggle logic:**
- Track `panelOpen` state (boolean). When `handleSetActiveTab` is called with the same tab, toggle panel closed. Different tab → open panel with that tab.

**2. Add right sidebar panel in the main area** (next to center canvas, inside `flex flex-1 min-h-0`):
- Render a ~300px wide panel on the right when `panelOpen` is true
- Based on `activeTab`, render the corresponding component:
  - `"media"` → `<MediaTab>` — scene thumbnails, regenerate
  - `"text"` → `<TextTab>` — text overlay controls, open TextOverlayDialog
  - `"music"` → `<MusicTab>` — music selection, audio upload
  - `"script"` → `<ScriptTab>` — voiceover scripts per scene
  - `"brand-kit"` → `<BrandKitTab>` — logo, colors, brand settings
  - `"card-editor"` → card editor settings panel

**3. Panel UI:**
- Dark glass-morphism style matching editor (bg-black/60, backdrop-blur, border-white/10)
- Header with tab name + close (X) button
- Scrollable content area
- Smooth slide-in animation

### Props needed
Each tab component already exists in `src/components/ad-director/editor/`. Wire them with the relevant props from ProVideoEditor state (storyboard, clips, brand, segments, overlays, audioTracks, etc.).

| File | Change |
|---|---|
| `ProVideoEditor.tsx` | Add `panelOpen` state, toggle logic in `handleSetActiveTab`, render right sidebar panel with tab-specific content |

