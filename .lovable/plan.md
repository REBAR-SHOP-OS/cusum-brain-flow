

# Auto-Apply Scripts as Text Overlays and Voiceovers

## Problem
The Script Chapters panel shows all the script text, but none of it is automatically applied to the timeline. The "Add text" and "Add audio" buttons require manual action. Users expect the script content to automatically appear as text overlays on the video and for voiceovers to auto-generate when entering the editor.

## Changes

### 1. Auto-create text overlays from script segments (`ProVideoEditor.tsx`)
Add a `useEffect` that watches `segments` and `storyboard`. For each segment with text, auto-create a `VideoOverlay` with `kind: "text"` positioned at bottom-center of its matching scene. Skip if an overlay already exists for that scene.

### 2. Auto-trigger voiceover generation on editor mount (`ProVideoEditor.tsx`)
Add a `useEffect` that runs once when the editor mounts (and segments are available). If `audioTracks` has no voiceovers, auto-call `generateAllVoiceovers()` to populate the Audio track from the script text.

### 3. Update script changes to refresh overlays
When `onUpdateSegment` is called and segment text changes, update the matching text overlay's content to stay in sync.

### Files
- `src/components/ad-director/ProVideoEditor.tsx` — add two useEffects for auto-seeding text overlays and auto-generating voiceovers from script segments

### Specific code additions

**Auto-seed text overlays** (after the logo overlay useEffect ~line 132):
```typescript
useEffect(() => {
  if (storyboard.length === 0 || segments.length === 0) return;
  const newOverlays: VideoOverlay[] = [];
  for (const scene of storyboard) {
    const seg = segments.find(s => s.id === scene.segmentId);
    if (!seg?.text?.trim()) continue;
    const hasText = overlays.some(o => o.sceneId === scene.id && o.kind === "text");
    if (!hasText) {
      newOverlays.push({
        id: crypto.randomUUID(),
        kind: "text",
        position: { x: 10, y: 80 },
        size: { w: 80, h: 15 },
        content: seg.text,
        opacity: 0.95,
        sceneId: scene.id,
        animated: true,
      });
    }
  }
  if (newOverlays.length > 0) setOverlays(prev => [...prev, ...newOverlays]);
}, [storyboard.length, segments]);
```

**Auto-generate voiceovers on mount** (after text overlay effect):
```typescript
const voiceoverGenerated = useRef(false);
useEffect(() => {
  if (voiceoverGenerated.current || segments.length === 0) return;
  if (audioTracks.some(a => a.kind === "voiceover")) return;
  voiceoverGenerated.current = true;
  generateAllVoiceovers();
}, [segments.length]);
```

