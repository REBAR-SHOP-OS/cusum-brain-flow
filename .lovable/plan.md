

# Remove Left Sidebar & Make Video Preview Square

## Problem
1. The "MY MEDIA" left sidebar panel (with Upload/Stock/Generate tabs) clutters the editor — user wants it removed entirely
2. The video preview area should display as a square (1:1 aspect ratio)

## Changes

### `src/components/ad-director/ProVideoEditor.tsx`

1. **Remove the entire Left Sidebar block** (lines 1216-1259) — the `w-60` div containing MY MEDIA, Text, Music, Brand Kit, Script, and Card Editor tab content panels
2. **Remove the TABS constant** (lines 36-43) and `activeTab` state (line 188) since no sidebar tabs are needed
3. **Remove tab-related props** (`externalActiveTab`, `onActiveTabChanged`) handling
4. **Make video preview square** — wrap the video/canvas in `aspect-ratio: 1/1` container:
   - Change the video container (line 1290) from `max-h-[50vh]` to a square aspect ratio wrapper using `aspect-square` class
   - Apply `object-contain` on the video/image inside so content fits within the square without distortion
5. **Clean up imports** — remove `FolderOpen`, `Type`, `Palette`, `SquarePen` if no longer used; remove `MediaTab`, `TextTab`, `MusicTab`, `BrandKitTab`, `ScriptTab`, `IntroOutroEditor` imports if only used in sidebar

The center canvas and timeline remain fully intact. Only the left panel is removed and the video display becomes square.

| File | Change |
|---|---|
| `ProVideoEditor.tsx` | Remove left sidebar panel, tab state/constants, make video preview 1:1 square |

