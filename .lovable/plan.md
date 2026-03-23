

## Simplify Pro Video Editor — Remove Non-Functional Features

### Problem
The editor has 13 sidebar tabs and many UI elements, but most are non-functional placeholders showing "Coming soon" toasts. This creates a confusing, cluttered interface.

### What Gets Removed

| Tab/Feature | Reason |
|---|---|
| **Record** | All 3 options show "Coming soon" |
| **Templates** | All 8 items show "Coming soon" |
| **Graphics** | All 7 items show "Coming soon" |
| **Stock Video** | Copies URL to clipboard, doesn't insert into video |
| **Stock Images** | Same — clipboard only, no integration |
| **Settings** | Presets (Overlay, Transition, Subtitle, Sticker, Text) don't affect output |
| **Transitions** (sidebar tab) | Selection stored in state but never applied to export |
| **Effects panel** (right panel) | Fade in/out sliders don't affect export; speed only affects playback |

### What Stays (6 functional tabs)

| Tab | Function |
|---|---|
| **My Media** | Scene list, regenerate, replace clips |
| **Text** | Add text overlays to scenes |
| **Music** | Select background music |
| **Script** | Edit voiceover text per scene |
| **Brand Kit** | Logo position, delete, replace |
| **Card Editor** | Intro/outro card design |

### UI Changes

**File: `src/components/ad-director/ProVideoEditor.tsx`**

1. **Reduce TABS array** from 13 to 6 — remove record, stock-video, stock-images, templates, graphics, transitions, settings
2. **Remove right panel** (EffectsPanel) — fade/speed controls don't work. Remove `rightPanelOpen` state and the entire right panel div
3. **Remove unused imports** — RecordTab, StockVideoTab, StockImagesTab, TemplatesTab, GraphicsTab, TransitionsTab, SettingsTab, EffectsPanel
4. **Remove unused state** — `editorSettings`, `transitionDuration`, `fadeIn`, `fadeOut`, `speed` (speed applied to video playback only, minor loss)
5. **Clean up tab content rendering** — remove all conditional renders for removed tabs
6. **Keep all functional logic** — AI command bar, timeline, voiceover generation, overlays, playback controls, undo/redo

Result: A clean 6-tab editor with only working features, reducing cognitive load significantly.

### Files
- `src/components/ad-director/ProVideoEditor.tsx` — remove 7 tabs, right panel, unused state/imports

