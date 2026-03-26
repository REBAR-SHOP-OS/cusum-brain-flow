

# Restore Timeline Toolbar Feature Icons

## Problem
The timeline toolbar (between playback controls and tracks) only shows "TIMELINE 0:15 / 0:15" and zoom buttons. The sidebar tab icons (Media, Text, Music, Brand Kit, Script, Card Editor) that previously appeared there are gone because `sidebarTabs={[]}` is passed as an empty array.

## Root Cause
In `ProVideoEditor.tsx` line 1379, `sidebarTabs` is hardcoded to `[]` instead of being populated with the available editor tabs.

## Solution
Populate `sidebarTabs` with the actual editor tab icons so they appear in the timeline toolbar, allowing quick tab switching.

### `src/components/ad-director/ProVideoEditor.tsx`
Replace `sidebarTabs={[]}` with an array of tab objects matching the `EditorTab` type:

```text
sidebarTabs={[
  { id: "media",       label: "Media",     icon: <Film className="w-3.5 h-3.5" /> },
  { id: "text",        label: "Text",      icon: <Type className="w-3.5 h-3.5" /> },
  { id: "music",       label: "Music",     icon: <Music className="w-3.5 h-3.5" /> },
  { id: "script",      label: "Script",    icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "brand-kit",   label: "Brand Kit", icon: <Palette className="w-3.5 h-3.5" /> },
  { id: "card-editor", label: "Card",      icon: <LayoutGrid className="w-3.5 h-3.5" /> },
]}
```

Ensure required icons (`Film`, `Palette`, `LayoutGrid`) are imported from lucide-react (some may already be imported).

| File | Change |
|---|---|
| `ProVideoEditor.tsx` | Populate `sidebarTabs` array with 6 editor tab icons instead of empty `[]` |

