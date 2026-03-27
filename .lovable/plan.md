

# Wire Up Remaining Dead UI Elements in ProVideoEditor

## Current State (Already Working)
- Back, Undo, Redo, Auto Voiceover, Download, Schedule — all wired
- Play/Pause, Mute, Fullscreen, Skip Scene, Seek bar — all wired
- All 10 context menu items (Select, Edit Prompt, Edit Voiceover, Trim, Stretch, Split, Duplicate, Mute, Regenerate, Delete) — all wired with real handlers
- Text overlay, Audio generation, Voiceover, Subtitle, Speed dialogs — all wired
- Scene drag-to-resize, playhead scrubbing, volume controls — all wired

## Actual Gaps to Fix

### 1. "Edit" Badge is Decorative (line 1421)
The `<Badge variant="secondary">Edit</Badge>` is not clickable. Replace with a button that opens the right panel with project settings (brand-kit tab).

### 2. Timeline Zoom Buttons Do Nothing (TimelineBar lines 344-346)
`ZoomIn`, `ZoomOut`, `Maximize` buttons have no handlers. Add a `zoomLevel` state to TimelineBar that scales the track width.

### 3. Missing Sidebar Tabs in Timeline Toolbar
Currently only shows: Media, Music, Voice, Subtitle, Text+Voice, Speed. Missing from user's request: **Text**, **Brand Kit**. Add these two tabs to the `sidebarTabs` array.

### 4. No Keyboard Shortcuts
Add `useEffect` with `keydown` listener for: Space (play/pause), Delete/Backspace (delete scene), Ctrl+Z (undo), Ctrl+Shift+Z (redo), S (split), D (duplicate).

### 5. No Contextual Empty State in Right Panel
When panel is open but nothing meaningful is selected, show a helpful empty state instead of blank panel.

## Implementation Plan

### File 1: `src/components/ad-director/ProVideoEditor.tsx`

**Change A — Replace Edit Badge with Button (line 1421)**
```tsx
<Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"
  onClick={() => handleSetActiveTab("brand-kit")}>
  <Edit3 className="w-3 h-3" /> Edit
</Button>
```

**Change B — Add Text and Brand tabs to sidebarTabs (lines 1647-1655)**
Add `{ id: "text", label: "Text", icon: <Type /> }` and `{ id: "brand-kit", label: "Brand", icon: <Palette /> }` to the sidebarTabs array.

**Change C — Add keyboard shortcuts (after line 706)**
```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    if (e.key === "Delete" || e.key === "Backspace") handleDeleteScene(selectedSceneIndex);
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
    if (e.key === "s" && !e.metaKey) handleSplitScene(selectedSceneIndex);
    if (e.key === "d" && !e.metaKey) handleDuplicateScene(selectedSceneIndex);
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [selectedSceneIndex, togglePlay, undo, redo]);
```

### File 2: `src/components/ad-director/editor/TimelineBar.tsx`

**Change A — Add zoom state and wire Zoom buttons (lines 344-346)**
Add `const [zoomLevel, setZoomLevel] = useState(1)` state. Wire ZoomIn to `setZoomLevel(z => Math.min(z * 1.5, 5))`, ZoomOut to `setZoomLevel(z => Math.max(z / 1.5, 0.5))`, Maximize to `setZoomLevel(1)`. Apply `style={{ width: \`${100 * zoomLevel}%\` }}` to the track container and wrap it in a horizontally scrollable div.

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — Edit button, sidebar tabs, keyboard shortcuts
- `src/components/ad-director/editor/TimelineBar.tsx` — zoom functionality

## Scope Note
The request lists ~13 categories of features. After code review, nearly all are already implemented. This plan addresses the 5 genuine gaps. No fake/dead actions remain after these fixes.

