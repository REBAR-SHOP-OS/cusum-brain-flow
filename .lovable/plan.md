

# Add Colored Draggable Bars for Text & Audio on Timeline

## What
Add two new track rows below the Video track in the timeline: a **Text track** (showing text overlays as colored bars) and an **Audio track** (showing voiceover/music items as colored bars). Each bar is draggable to reposition across scenes.

## Current State
- `TimelineBar.tsx` already receives `textOverlays` and `audioTracks` as props
- Drag-to-reposition logic (`handleItemDragStart`, `onMoveOverlay`, `onMoveAudioTrack`) is fully wired
- But no visual track rows exist — only the Video row is rendered

## Plan

### File: `src/components/ad-director/editor/TimelineBar.tsx`

**After the Video track `</div>` (after line ~536), add two new track rows:**

#### 1. Text Overlay Track Row
- Left label: `VolumeControl` or simple icon label showing "Text" with `Type` icon
- Track area: Map over `textOverlays`, compute each bar's `left%` and `width%` based on its `sceneId` matching `cumulativeStarts`/scene duration
- Bar style: **Purple/violet** colored rounded bar (`bg-violet-500/70`) with truncated text content, 16px tall
- Each bar has `onMouseDown` → `handleItemDragStart("text", overlay.id, leftPct, widthPct)`
- When `draggedItemId === overlay.id`, apply `itemDragOffsetPx` as a `translateX` transform
- Click → `onEditOverlay?.(overlay)`
- Delete button on hover

#### 2. Audio Track Row
- Left label: "Audio" with `Music`/`Mic` icon
- Track area: Map over `audioTracks`, compute position from `sceneId`
- Bar style: **Teal/cyan** for voiceover (`bg-teal-500/70`), **amber** for music (`bg-amber-500/70`), 16px tall
- Each bar has `onMouseDown` → `handleItemDragStart("audio", String(index), leftPct, widthPct)`
- When dragged, apply offset transform
- Click → volume popover or edit action
- Delete button on hover

#### Position Calculation (shared helper)
```ts
function getItemBarPosition(sceneId: string): { leftPct: number; widthPct: number } {
  const idx = storyboard.findIndex(s => s.id === sceneId);
  if (idx < 0) return { leftPct: 0, widthPct: 0 };
  const leftPct = (cumulativeStarts[idx] / totalDuration) * 100;
  const dur = getSceneDur(idx);
  const widthPct = (dur / totalDuration) * 100;
  return { leftPct, widthPct };
}
```

#### Bar Component Structure
```tsx
<div className="flex items-center gap-0.5">
  <span className="w-14 text-[9px] text-muted-foreground flex items-center gap-1">
    <Type className="w-3 h-3" /> Text
  </span>
  <div className="flex-1 h-5 relative rounded bg-muted/20">
    {textOverlays.map(ov => {
      const { leftPct, widthPct } = getItemBarPosition(ov.sceneId);
      const isBeingDragged = draggedItemId === ov.id;
      return (
        <div
          key={ov.id}
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-violet-500/70 cursor-grab 
                     hover:bg-violet-500/90 transition-colors flex items-center px-1 group"
          style={{
            left: `${leftPct}%`, width: `${widthPct}%`,
            transform: isBeingDragged ? `translateX(${itemDragOffsetPx}px)` : undefined,
            zIndex: isBeingDragged ? 30 : 5,
          }}
          onMouseDown={e => handleItemDragStart(e, "text", ov.id, leftPct, widthPct)}
        >
          <span className="text-[8px] text-white truncate">{ov.content}</span>
          {onDeleteOverlay && (
            <button onClick={e => { e.stopPropagation(); onDeleteOverlay(ov.id); }}
              className="hidden group-hover:block absolute right-0.5 top-0.5">
              <Trash2 className="w-2.5 h-2.5 text-white/70" />
            </button>
          )}
        </div>
      );
    })}
  </div>
</div>
```

Same pattern for audio, with color based on `track.kind`.

## Files changed
- `src/components/ad-director/editor/TimelineBar.tsx` — add Text and Audio track rows with colored draggable bars

