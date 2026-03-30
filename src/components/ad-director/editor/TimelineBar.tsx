import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  ZoomIn, ZoomOut, Maximize, Music, Type, Plus, Mic,
  Volume2, VolumeX, Trash2, RefreshCw, Edit3, Move,
  Scissors, Expand, SplitSquareHorizontal, Copy,
  ArrowLeft, ArrowRight, VolumeOff, FileText,
  RotateCcw, Sparkles, MoveVertical,
  LayoutGrid, Rows3, GripVertical,
} from "lucide-react";
import type { ClipOutput, StoryboardScene, ScriptSegment } from "@/types/adDirector";
import type { VideoOverlay } from "@/types/videoOverlay";

// ─── Thumbnail extraction helper ───────────────────────────
function useVideoThumbnails(clips: ClipOutput[]) {
  const [thumbnails, setThumbnails] = useState<Record<string, string[]>>({});
  const extractedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    clips.forEach((clip) => {
      if (clip.status !== "completed" || !clip.videoUrl || extractedRef.current.has(clip.sceneId)) return;
      extractedRef.current.add(clip.sceneId);

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;

      const FRAME_COUNT = 6;
      const frames: string[] = [];
      let frameIndex = 0;
      let timePoints: number[] = [];

      video.onloadeddata = () => {
        const dur = video.duration || 1;
        timePoints = Array.from({ length: FRAME_COUNT }, (_, i) => (i / FRAME_COUNT) * dur + 0.1);
        video.currentTime = timePoints[0];
      };

      video.onseeked = () => {
        try {
          const c = document.createElement("canvas");
          c.width = 320;
          c.height = 180;
          const cx = c.getContext("2d");
          if (cx) {
            cx.drawImage(video, 0, 0, 320, 180);
            frames.push(c.toDataURL("image/jpeg", 0.85));
          }
        } catch { /* CORS — ignore */ }

        frameIndex++;
        if (frameIndex < FRAME_COUNT && frameIndex < timePoints.length) {
          video.currentTime = timePoints[frameIndex];
        } else {
          setThumbnails(prev => ({ ...prev, [clip.sceneId]: frames }));
          video.src = "";
          video.load();
        }
      };

      video.onerror = () => {
        extractedRef.current.delete(clip.sceneId);
      };

      video.src = clip.videoUrl;
    });
  }, [clips]);

  return thumbnails;
}

export interface AudioTrackItem {
  sceneId: string;
  label: string;
  audioUrl: string;
  kind: "voiceover" | "music";
  volume?: number; // 0-1, default 1
  startTime?: number; // seconds within the scene
  endTime?: number;   // seconds within the scene
}

interface SidebarTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface TimelineBarProps {
  clips: ClipOutput[];
  storyboard: StoryboardScene[];
  segments: ScriptSegment[];
  globalTime: number;
  totalDuration: number;
  cumulativeStarts: number[];
  selectedSceneIndex: number;
  onSeek: (globalTimeSec: number) => void;
  onSelectScene: (index: number) => void;
  onAddText?: () => void;
  onAddAudio?: () => void;
  textOverlays?: VideoOverlay[];
  audioTracks?: AudioTrackItem[];
  // Sidebar tab icons
  sidebarTabs?: SidebarTab[];
  activeSidebarTab?: string;
  onSidebarTabSelect?: (tabId: string) => void;
  // Volume controls
  videoVolume?: number;
  onVideoVolumeChange?: (v: number) => void;
  onAudioTrackVolumeChange?: (index: number, v: number) => void;
  // Edit actions
  onDeleteOverlay?: (id: string) => void;
  onEditOverlay?: (overlay: VideoOverlay) => void;
  onRemoveAudioTrack?: (index: number) => void;
  onRegenerateScene?: (sceneId: string) => void;
  onDeleteScene?: (index: number) => void;
  // New editing actions
  onTrimScene?: (index: number) => void;
  onStretchScene?: (index: number) => void;
  onSplitScene?: (index: number) => void;
  onDuplicateScene?: (index: number) => void;
  onMoveScene?: (index: number, dir: -1 | 1) => void;
  onEditPrompt?: (index: number) => void;
  onEditVoiceover?: (index: number) => void;
  onMuteScene?: (index: number) => void;
  onResizeScene?: (index: number, newDuration: number) => void;
  mutedScenes?: Set<string>;
  // Text overlay extras
  onEditOverlayPosition?: (id: string, position: "top" | "center" | "bottom") => void;
  onResizeOverlay?: (id: string, size: "small" | "medium" | "large") => void;
  onToggleOverlayAnimation?: (id: string) => void;
  // Audio extras
  onReRecordVoiceover?: (sceneId: string, customText?: string) => void;
  onUpdateVoiceoverText?: (sceneId: string, text: string) => void;
  onEditVoiceoverText?: (sceneId: string) => void;
  // Drag-to-reposition (with optional startTime for free-positioning)
  onMoveOverlay?: (id: string, newSceneId: string, startTime?: number) => void;
  onMoveAudioTrack?: (index: number, newSceneId: string, startTime?: number) => void;
}

export function TimelineBar({
  clips, storyboard, segments, globalTime, totalDuration,
  cumulativeStarts, selectedSceneIndex, onSeek, onSelectScene,
  onAddText, onAddAudio, textOverlays = [], audioTracks = [],
  videoVolume = 1, onVideoVolumeChange, onAudioTrackVolumeChange,
  onDeleteOverlay, onEditOverlay, onRemoveAudioTrack,
  onRegenerateScene, onDeleteScene,
  sidebarTabs = [], activeSidebarTab, onSidebarTabSelect,
  onTrimScene, onStretchScene, onSplitScene, onDuplicateScene,
  onMoveScene, onEditPrompt, onEditVoiceover, onMuteScene, onResizeScene, mutedScenes,
  onEditOverlayPosition, onResizeOverlay, onToggleOverlayAnimation,
  onReRecordVoiceover, onUpdateVoiceoverText, onEditVoiceoverText,
  onMoveOverlay, onMoveAudioTrack,
}: TimelineBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [textTrackMuted, setTextTrackMuted] = useState(false);
  const [voiceoverTexts, setVoiceoverTexts] = useState<Record<string, string>>({});
  const dragState = useRef<{ index: number; startX: number; startDur: number; side: "left" | "right" } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const thumbnails = useVideoThumbnails(clips);
  const [viewMode, setViewMode] = useState<"expanded" | "compact">("expanded");

  // ─── Scene drag-to-reorder state ───
  const [sceneDragIdx, setSceneDragIdx] = useState<number | null>(null);
  const [sceneDropIdx, setSceneDropIdx] = useState<number | null>(null);

  // ─── Item drag-to-reposition state ───
  const itemDragRef = useRef<{
    type: "text" | "audio";
    id: string;       // overlay id or audio track index as string
    startX: number;
    origLeftPct: number;
    origWidthPct: number;
  } | null>(null);
  const [itemDragOffsetPx, setItemDragOffsetPx] = useState(0);
  const [itemDragging, setItemDragging] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // ─── Playhead scrub state ───
  const scrubbingRef = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: MouseEvent) => {
      if (!scrubbingRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const snappedTime = Math.round(pct * totalDuration * 10) / 10;
      onSeek(Math.max(0, Math.min(totalDuration, snappedTime)));
    };
    const onUp = () => {
      scrubbingRef.current = false;
      setScrubbing(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scrubbing, totalDuration, onSeek]);

  // Find which scene a global time (seconds) falls into
  const findSceneAtTime = useCallback((timeSec: number): { sceneIdx: number; localTime: number } => {
    for (let i = 0; i < storyboard.length; i++) {
      const start = cumulativeStarts[i] || 0;
      const dur = getSceneDur(i);
      if (timeSec >= start && timeSec < start + dur) {
        return { sceneIdx: i, localTime: timeSec - start };
      }
    }
    const lastIdx = storyboard.length - 1;
    return { sceneIdx: lastIdx, localTime: Math.max(0, timeSec - (cumulativeStarts[lastIdx] || 0)) };
  }, [storyboard, cumulativeStarts]);

  // Find which scene a percentage position falls into
  const findSceneAtPct = useCallback((pct: number) => {
    const timeSec = (pct / 100) * totalDuration;
    return findSceneAtTime(timeSec).sceneIdx;
  }, [totalDuration, findSceneAtTime]);

  const handleItemDragStart = useCallback((
    e: React.MouseEvent,
    type: "text" | "audio",
    id: string,
    leftPct: number,
    widthPct: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    itemDragRef.current = { type, id, startX: e.clientX, origLeftPct: leftPct, origWidthPct: widthPct };
    setItemDragOffsetPx(0);
    setItemDragging(true);
    setDraggedItemId(type === "audio" ? `audio-${id}` : id);
  }, []);

  useEffect(() => {
    if (!itemDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!itemDragRef.current) return;
      setItemDragOffsetPx(e.clientX - itemDragRef.current.startX);
    };
    const onUp = (e: MouseEvent) => {
      if (!itemDragRef.current || !trackRef.current) {
        setItemDragging(false);
        setDraggedItemId(null);
        return;
      }
      const trackWidth = trackRef.current.getBoundingClientRect().width;
      const dx = e.clientX - itemDragRef.current.startX;
      const deltaPct = (dx / trackWidth) * 100;
      // Calculate new center position in time
      const newLeftPct = Math.max(0, Math.min(100, itemDragRef.current.origLeftPct + deltaPct));
      const newTimeSec = (newLeftPct / 100) * totalDuration;
      const { sceneIdx, localTime } = findSceneAtTime(newTimeSec);
      const targetSceneId = storyboard[sceneIdx]?.id;

      if (targetSceneId) {
        if (itemDragRef.current.type === "text") {
          onMoveOverlay?.(itemDragRef.current.id, targetSceneId, localTime);
        } else {
          onMoveAudioTrack?.(parseInt(itemDragRef.current.id), targetSceneId, localTime);
        }
      }

      itemDragRef.current = null;
      setItemDragging(false);
      setItemDragOffsetPx(0);
      setDraggedItemId(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [itemDragging, storyboard, totalDuration, findSceneAtTime, onMoveOverlay, onMoveAudioTrack]);

  // Drag-to-resize handlers
  const handleDragStart = useCallback((e: React.MouseEvent, index: number, side: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    const dur = getSceneDurForDrag(index);
    dragState.current = { index, startX: e.clientX, startDur: dur, side };
    setIsDragging(true);
  }, []);

  const getSceneDurForDrag = (i: number) => {
    const seg = segments.find(s => s.id === storyboard[i]?.segmentId);
    return seg ? seg.endTime - seg.startTime : 4;
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current || !trackRef.current) return;
      const trackWidth = trackRef.current.getBoundingClientRect().width;
      const pxPerSec = trackWidth / totalDuration;
      const dx = e.clientX - dragState.current.startX;
      const deltaSec = dx / pxPerSec;
      const newDur = dragState.current.side === "right"
        ? dragState.current.startDur + deltaSec
        : dragState.current.startDur - deltaSec;
      const clamped = Math.max(1, newDur);
      onResizeScene?.(dragState.current.index, clamped);
    };
    const handleMouseUp = () => {
      dragState.current = null;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, totalDuration, onResizeScene]);

  const playheadPct = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0;

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const snappedTime = Math.round(pct * totalDuration);
    onSeek(Math.max(0, Math.min(totalDuration, snappedTime)));
  };

  const getSceneDur = (i: number) => {
    const seg = segments.find(s => s.id === storyboard[i]?.segmentId);
    return seg ? seg.endTime - seg.startTime : 4;
  };

  // ─── Scene drag-to-reorder handlers ───
  const handleSceneDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    setSceneDragIdx(idx);
  }, []);

  const handleSceneDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setSceneDropIdx(idx);
  }, []);

  const handleSceneDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const fromIdx = sceneDragIdx;
    setSceneDragIdx(null);
    setSceneDropIdx(null);
    if (fromIdx === null || fromIdx === dropIdx || !onMoveScene) return;
    // Move one step at a time to reach the target
    const dir = dropIdx > fromIdx ? 1 : -1;
    let current = fromIdx;
    while (current !== dropIdx) {
      onMoveScene(current, dir as -1 | 1);
      current += dir;
    }
  }, [sceneDragIdx, onMoveScene]);

  const handleSceneDragEnd = useCallback(() => {
    setSceneDragIdx(null);
    setSceneDropIdx(null);
  }, []);

  return (
    <div className="border-t border-border/40 bg-card/80 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Timeline</span>
        <span className="text-[10px] text-muted-foreground font-mono ml-2">
          {formatTime(globalTime)} / {formatTime(totalDuration)}
        </span>
        {sidebarTabs.length > 0 && (
          <div className="flex items-center gap-0.5 ml-3 pl-3 border-l border-border/20">
            {sidebarTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onSidebarTabSelect?.(tab.id)}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors
                  ${activeSidebarTab === tab.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
                title={tab.label}
              >
                {tab.icon}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[9px] gap-1"
          onClick={() => setViewMode(v => v === "expanded" ? "compact" : "expanded")}
          title={viewMode === "expanded" ? "Compact view" : "Expanded view"}
        >
          {viewMode === "expanded" ? <LayoutGrid className="w-3 h-3" /> : <Rows3 className="w-3 h-3" />}
          {viewMode === "expanded" ? "Cards" : "Track"}
        </Button>
        {viewMode === "expanded" && (
          <>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoomLevel(z => Math.max(z / 1.5, 0.5))} title="Zoom Out"><ZoomOut className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoomLevel(z => Math.min(z * 1.5, 5))} title="Zoom In"><ZoomIn className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoomLevel(1)} title="Fit"><Maximize className="w-3 h-3" /></Button>
          </>
        )}
      </div>

      {/* ─── Compact card view ─── */}
      {viewMode === "compact" && (
        <div className="px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="flex items-center gap-2">
            {storyboard.map((scene, i) => {
              const clip = clips.find(c => c.sceneId === scene.id);
              const seg = segments.find(s => s.id === scene.segmentId);
              const isSelected = i === selectedSceneIndex;
              const isCompleted = clip?.status === "completed";
              const isGenerating = clip?.status === "generating";
              const durSec = seg ? (seg.endTime - seg.startTime).toFixed(0) : "--";
              const isDropTarget = sceneDropIdx === i && sceneDragIdx !== null && sceneDragIdx !== i;

              return (
                <div
                  key={scene.id}
                  draggable={!!onMoveScene}
                  onDragStart={(e) => handleSceneDragStart(e, i)}
                  onDragOver={(e) => handleSceneDragOver(e, i)}
                  onDrop={(e) => handleSceneDrop(e, i)}
                  onDragEnd={handleSceneDragEnd}
                  onClick={() => onSelectScene(i)}
                  className={`relative flex-shrink-0 w-[120px] h-12 rounded-md overflow-hidden cursor-pointer transition-all
                    ${isSelected ? "ring-2 ring-primary" : "ring-1 ring-border/40"}
                    ${sceneDragIdx === i ? "opacity-40" : ""}
                    ${isDropTarget ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
                    ${isCompleted ? "bg-emerald-900/40" : isGenerating ? "bg-blue-900/30 animate-pulse" : "bg-muted/30"}
                  `}
                >
                  {/* Thumbnail */}
                  {thumbnails[scene.id]?.[0] ? (
                    <>
                      <img src={thumbnails[scene.id][0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    </>
                  ) : null}
                  {/* Duration badge */}
                  <span className="absolute top-0.5 left-0.5 text-[7px] px-1 py-px rounded-full bg-black/50 text-white font-mono z-10">{durSec}s</span>
                  {/* Status dot */}
                  <div className="absolute top-1 right-1 z-10">
                    <div className={`w-2 h-2 rounded-full ${isCompleted ? "bg-emerald-400" : isGenerating ? "bg-blue-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                  </div>
                  {/* Drag handle */}
                  {onMoveScene && (
                    <GripVertical className="absolute top-1 left-[calc(50%-5px)] w-2.5 h-2.5 text-white/50 z-10" />
                  )}
                  {/* Scene title */}
                  <div className="absolute bottom-0.5 left-1 right-1 z-10">
                    <div className="text-[8px] text-white font-medium truncate drop-shadow-sm">
                      {seg?.label || `Scene ${i + 1}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Expanded track view ─── */}
      {viewMode === "expanded" && (
      <div className="px-3 py-2 space-y-1.5 relative overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <div style={{ width: `${100 * zoomLevel}%`, minWidth: "100%" }}>
        {/* ─── Time ruler ─── */}
        <div className="flex items-center gap-0.5 mb-1">
          <span className="w-14 shrink-0" />
          <div className="flex-1 h-4 relative border-b border-border/30">
            {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, sec) => {
              const leftPct = (sec / totalDuration) * 100;
              if (leftPct > 100) return null;
              const isMajor = sec % 2 === 0;
              return (
                <div key={sec} className="absolute top-0 bottom-0" style={{ left: `${leftPct}%` }}>
                  <div className={`absolute bottom-0 w-px ${isMajor ? 'h-3 bg-muted-foreground/50' : 'h-1.5 bg-muted-foreground/25'}`} />
                  {isMajor && (
                    <span className="absolute bottom-3.5 text-[7px] text-muted-foreground font-mono -translate-x-1/2 select-none">{sec}s</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Video track ─── */}
        <div className="flex items-center gap-0.5">
          <VolumeControl
            label="Video"
            volume={videoVolume}
            onVolumeChange={onVideoVolumeChange}
          />
           <div
            ref={trackRef}
            className="flex-1 flex gap-px h-20 relative cursor-pointer rounded overflow-hidden"
            onClick={handleTrackClick}
          >
            {storyboard.map((scene, i) => {
              const dur = getSceneDur(i);
              const clip = clips.find(c => c.sceneId === scene.id);
              const seg = segments.find(s => s.id === scene.segmentId);
              const isSelected = i === selectedSceneIndex;
              const isCompleted = clip?.status === "completed";
              const isGenerating = clip?.status === "generating";
              const durSec = seg ? (seg.endTime - seg.startTime).toFixed(0) : "--";
              const isDropTarget = sceneDropIdx === i && sceneDragIdx !== null && sceneDragIdx !== i;

              return (
                <Popover key={scene.id}>
                  <PopoverTrigger asChild>
                    <div
                      draggable={!!onMoveScene}
                      onDragStart={(e) => handleSceneDragStart(e, i)}
                      onDragOver={(e) => handleSceneDragOver(e, i)}
                      onDrop={(e) => handleSceneDrop(e, i)}
                      onDragEnd={handleSceneDragEnd}
                      onClick={(e) => { e.stopPropagation(); onSelectScene(i); }}
                      className={`relative h-full flex flex-col items-start justify-end transition-all cursor-pointer overflow-hidden
                        ${isSelected ? "ring-2 ring-primary ring-inset z-10" : ""}
                        ${isDropTarget ? "ring-2 ring-primary ring-inset" : ""}
                        ${sceneDragIdx === i ? "opacity-40" : ""}
                        ${isCompleted ? "bg-emerald-900/40" : isGenerating ? "bg-blue-900/30 animate-pulse" : "bg-muted/30"}
                      `}
                      style={{ flex: dur }}
                      title={seg?.label || `Scene ${i + 1}`}
                    >
                      {/* Left drag handle */}
                      {onResizeScene && (
                        <div
                          onMouseDown={(e) => handleDragStart(e, i, "left")}
                          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/60 z-20"
                        />
                      )}
                      {/* Live thumbnail preview */}
                      {thumbnails[scene.id]?.length ? (
                        <>
                          <div className="absolute inset-0 flex">
                            {thumbnails[scene.id].map((frame, fi) => (
                              <img
                                key={fi}
                                src={frame}
                                alt=""
                                className="h-full object-cover flex-1 min-w-0"
                              />
                            ))}
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        </>
                      ) : clip?.videoUrl ? (
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-800/20 to-emerald-700/20" />
                      ) : null}
                      {/* Status badge */}
                      <div className="absolute top-0.5 right-0.5 z-10">
                        <span className={`text-[7px] px-1 py-px rounded-full font-medium ${
                          isCompleted ? "bg-emerald-500/80 text-white" : isGenerating ? "bg-blue-500/80 text-white" : "bg-muted/60 text-muted-foreground"
                        }`}>
                          {isCompleted ? "done" : isGenerating ? "gen…" : clip?.status || "idle"}
                        </span>
                      </div>
                      {/* Duration badge */}
                      <div className="absolute top-0.5 left-0.5 z-10">
                        <span className="text-[7px] px-1 py-px rounded-full bg-black/50 text-white font-mono">{durSec}s</span>
                      </div>
                      {/* Drop indicator line */}
                      {isDropTarget && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary z-30" />
                      )}
                      {/* Scene info */}
                      <div className="relative z-10 px-1 pb-0.5 w-full">
                        <div className="text-[8px] text-white font-semibold truncate drop-shadow-sm">
                          {scene.objective || seg?.label || `Scene ${i + 1}`}
                        </div>
                        {seg?.text && (
                          <div className="text-[7px] text-white/70 truncate drop-shadow-sm">
                            {seg.text.slice(0, 40)}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                      )}
                      {/* Right drag handle */}
                      {onResizeScene && (
                        <div
                          onMouseDown={(e) => handleDragStart(e, i, "right")}
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/60 z-20"
                        />
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1.5" side="top" align="center">
                    <div className="space-y-0.5">
                      <button
                        onClick={() => onSelectScene(i)}
                        className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground"
                      >Select</button>
                      {onEditPrompt && (
                        <button
                          onClick={() => onEditPrompt(i)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><Edit3 className="w-2.5 h-2.5" />Edit Prompt</button>
                      )}
                      {onEditVoiceover && (
                        <button
                          onClick={() => onEditVoiceover(i)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><FileText className="w-2.5 h-2.5" />Edit Voiceover Text</button>
                      )}
                      {onTrimScene && (
                        <button
                          onClick={() => onTrimScene(i)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><Scissors className="w-2.5 h-2.5" />Trim (−1s)</button>
                      )}
                      {onStretchScene && (
                        <button
                          onClick={() => onStretchScene(i)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><Expand className="w-2.5 h-2.5" />Stretch (+1s)</button>
                      )}
                      {onSplitScene && (
                        <button
                          onClick={() => onSplitScene(i)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><SplitSquareHorizontal className="w-2.5 h-2.5" />Split</button>
                      )}
                      {onDuplicateScene && (
                        <button
                          onClick={() => onDuplicateScene(i)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><Copy className="w-2.5 h-2.5" />Duplicate</button>
                      )}
                      {onMoveScene && i > 0 && (
                        <button
                          onClick={() => onMoveScene(i, -1)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><ArrowLeft className="w-2.5 h-2.5" />Move Left</button>
                      )}
                      {onMoveScene && i < storyboard.length - 1 && (
                        <button
                          onClick={() => onMoveScene(i, 1)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><ArrowRight className="w-2.5 h-2.5" />Move Right</button>
                      )}
                      {onMuteScene && (
                        <button
                          onClick={() => onMuteScene(i)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><VolumeOff className="w-2.5 h-2.5" />{mutedScenes?.has(scene.id) ? "Unmute" : "Mute Scene"}</button>
                      )}
                      {onRegenerateScene && isCompleted && (
                        <button
                          onClick={() => onRegenerateScene(scene.id)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                        ><RefreshCw className="w-2.5 h-2.5" />Regenerate</button>
                      )}
                      {onDeleteScene && (
                        <button
                          onClick={() => onDeleteScene(i)}
                          className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-destructive/20 text-destructive flex items-center gap-1"
                        ><Trash2 className="w-2.5 h-2.5" />Delete</button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}

            {/* Playhead — draggable for scrubbing */}
            <div
              className={`absolute top-0 bottom-0 z-20 ${scrubbing ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ left: `${playheadPct}%`, width: '14px', transform: 'translateX(-6px)', transition: scrubbing ? 'none' : 'left 0.1s linear' }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                scrubbingRef.current = true;
                setScrubbing(true);
              }}
            >
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white -translate-x-1/2" />
              <div className={`absolute left-1/2 -translate-x-1/2 -translate-y-0.5 rounded-full bg-white transition-transform ${scrubbing ? 'w-3 h-3' : 'w-2 h-2'}`} />
            </div>
          </div>
      </div>

      {/* ─── Text overlay track ─── */}
      {textOverlays.length > 0 && (
        <div className="flex items-center gap-0.5 mt-1">
          <span className="w-14 shrink-0 text-[9px] text-muted-foreground flex items-center gap-1">
            <Type className="w-3 h-3" /> Text
          </span>
          <div className="flex-1 h-5 relative rounded bg-muted/20 overflow-hidden">
            {textOverlays.map((ov) => {
              const idx = storyboard.findIndex(s => s.id === ov.sceneId);
              if (idx < 0) return null;
              const sceneStart = cumulativeStarts[idx] || 0;
              const sceneDur = getSceneDur(idx);
              const itemStart = ov.startTime ?? 0;
              const itemEnd = ov.endTime ?? sceneDur;
              const absStart = sceneStart + itemStart;
              const absEnd = sceneStart + Math.min(itemEnd, sceneDur);
              const leftPct = (absStart / totalDuration) * 100;
              const widthPct = ((absEnd - absStart) / totalDuration) * 100;
              const isBeingDragged = draggedItemId === ov.id;
              return (
                <div
                  key={ov.id}
                  className="absolute top-0.5 bottom-0.5 rounded-sm bg-violet-500/70 cursor-grab hover:bg-violet-500/90 transition-colors flex items-center px-1 group"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 0.8)}%`,
                    transform: isBeingDragged ? `translateX(${itemDragOffsetPx}px)` : undefined,
                    zIndex: isBeingDragged ? 30 : 5,
                  }}
                  onMouseDown={(e) => handleItemDragStart(e, "text", ov.id, leftPct, widthPct)}
                  onClick={(e) => { e.stopPropagation(); onEditOverlay?.(ov); }}
                >
                  <span className="text-[8px] text-white truncate select-none">{ov.content}</span>
                  {onDeleteOverlay && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteOverlay(ov.id); }}
                      className="hidden group-hover:flex absolute right-0.5 top-0.5 items-center justify-center w-3 h-3 rounded-full bg-black/40"
                    >
                      <Trash2 className="w-2 h-2 text-white/80" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Audio track ─── */}
      {audioTracks.length > 0 && (
        <div className="flex items-center gap-0.5 mt-1">
          <span className="w-14 shrink-0 text-[9px] text-muted-foreground flex items-center gap-1">
            <Music className="w-3 h-3" /> Audio
          </span>
          <div className="flex-1 h-5 relative rounded bg-muted/20 overflow-hidden">
            {audioTracks.map((track, tIdx) => {
              const idx = storyboard.findIndex(s => s.id === track.sceneId);
              if (idx < 0) return null;
              const sceneStart = cumulativeStarts[idx] || 0;
              const sceneDur = getSceneDur(idx);
              const itemStart = track.startTime ?? 0;
              const itemEnd = track.endTime ?? sceneDur;
              const absStart = sceneStart + itemStart;
              const absEnd = sceneStart + Math.min(itemEnd, sceneDur);
              const leftPct = (absStart / totalDuration) * 100;
              const widthPct = ((absEnd - absStart) / totalDuration) * 100;
              const itemId = `audio-${tIdx}`;
              const isBeingDragged = draggedItemId === itemId;
              const barColor = track.kind === "voiceover" ? "bg-teal-500/70 hover:bg-teal-500/90" : "bg-amber-500/70 hover:bg-amber-500/90";
              return (
                <div
                  key={itemId}
                  className={`absolute top-0.5 bottom-0.5 rounded-sm cursor-grab transition-colors flex items-center px-1 group ${barColor}`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 0.8)}%`,
                    transform: isBeingDragged ? `translateX(${itemDragOffsetPx}px)` : undefined,
                    zIndex: isBeingDragged ? 30 : 5,
                  }}
                  onMouseDown={(e) => handleItemDragStart(e, "audio", String(tIdx), leftPct, widthPct)}
                >
                  <span className="text-[8px] text-white truncate select-none">
                    {track.kind === "voiceover" ? "🎙" : "🎵"} {track.label}
                  </span>
                  {onRemoveAudioTrack && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveAudioTrack(tIdx); }}
                      className="hidden group-hover:flex absolute right-0.5 top-0.5 items-center justify-center w-3 h-3 rounded-full bg-black/40"
                    >
                      <Trash2 className="w-2 h-2 text-white/80" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>
      </div>
      )}
    </div>
  );
}

/* ─── Inline Volume Control ─── */
function VolumeControl({
  label,
  volume,
  onVolumeChange,
  hideSlider,
}: {
  label: string;
  volume: number;
  onVolumeChange?: (v: number) => void;
  hideSlider?: boolean;
}) {
  const isMuted = volume === 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-0.5 w-14 shrink-0 group" title={`${label} volume`}>
          {isMuted
            ? <VolumeX className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
            : <Volume2 className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
          }
          <span className="text-[9px] text-muted-foreground group-hover:text-foreground truncate transition-colors">{label}</span>
        </button>
      </PopoverTrigger>
      {!hideSlider && onVolumeChange && (
        <PopoverContent className="w-40 p-2" side="top" align="start">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-foreground">{label} Volume</p>
            <Slider
              value={[Math.round(volume * 100)]}
              min={0} max={100} step={1}
              onValueChange={([v]) => onVolumeChange(v / 100)}
              className="w-full"
            />
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-muted-foreground">{Math.round(volume * 100)}%</span>
              <button
                onClick={() => onVolumeChange(isMuted ? 1 : 0)}
                className="text-[9px] text-muted-foreground hover:text-foreground"
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
