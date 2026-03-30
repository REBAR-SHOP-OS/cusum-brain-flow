import { useRef, useState, useCallback, useEffect, useMemo } from "react";
// Trim mode state is managed locally in TimelineBar
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
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
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
  volume?: number;
  startTime?: number;
  endTime?: number;
  globalStartTime?: number;
  duration?: number;
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
  sidebarTabs?: SidebarTab[];
  activeSidebarTab?: string;
  onSidebarTabSelect?: (tabId: string) => void;
  videoVolume?: number;
  onVideoVolumeChange?: (v: number) => void;
  onAudioTrackVolumeChange?: (index: number, v: number) => void;
  onDeleteOverlay?: (id: string) => void;
  onEditOverlay?: (overlay: VideoOverlay) => void;
  onRemoveAudioTrack?: (index: number) => void;
  onRegenerateScene?: (sceneId: string) => void;
  onDeleteScene?: (index: number) => void;
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
  onEditOverlayPosition?: (id: string, position: "top" | "center" | "bottom") => void;
  onResizeOverlay?: (id: string, size: "small" | "medium" | "large") => void;
  onToggleOverlayAnimation?: (id: string) => void;
  onReRecordVoiceover?: (sceneId: string, customText?: string) => void;
  onUpdateVoiceoverText?: (sceneId: string, text: string) => void;
  onEditVoiceoverText?: (sceneId: string) => void;
  onMoveOverlay?: (id: string, newSceneId: string, startTime?: number) => void;
  onMoveAudioTrack?: (index: number, newSceneId: string, startTime?: number) => void;
  onRegenerateAll?: () => void;
  isRegeneratingAll?: boolean;
  // Playback integration
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onFrameStep?: (dir: -1 | 1) => void;
  onSkipScene?: (dir: -1 | 1) => void;
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
  onRegenerateAll, isRegeneratingAll,
  isPlaying, onTogglePlay, onFrameStep, onSkipScene,
}: TimelineBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [textTrackMuted, setTextTrackMuted] = useState(false);
  const [voiceoverTexts, setVoiceoverTexts] = useState<Record<string, string>>({});
  const dragState = useRef<{ index: number; startX: number; startDur: number; side: "left" | "right" } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const thumbnails = useVideoThumbnails(clips);
  const [viewMode, setViewMode] = useState<"expanded" | "compact">("expanded");
  const [selectedAudioIdx, setSelectedAudioIdx] = useState<number | null>(null);
  const [snapGuidePos, setSnapGuidePos] = useState<number | null>(null);
  const [trimMode, setTrimMode] = useState(false);

  useEffect(() => { setSelectedAudioIdx(null); setTrimMode(false); }, [selectedSceneIndex]);

  // ─── Scene drag-to-reorder state ───
  const [sceneDragIdx, setSceneDragIdx] = useState<number | null>(null);
  const [sceneDropIdx, setSceneDropIdx] = useState<number | null>(null);

  // ─── Item drag-to-reposition state ───
  const itemDragRef = useRef<{
    type: "text" | "audio";
    id: string;
    startX: number;
    origLeftPct: number;
    origWidthPct: number;
  } | null>(null);
  const [itemDragOffsetPx, setItemDragOffsetPx] = useState(0);
  const [itemDragging, setItemDragging] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // ─── rAF Playhead ───
  const rafRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);

  // Smooth playhead positioning via rAF (bypass React re-renders)
  useEffect(() => {
    const update = () => {
      if (playheadRef.current && trackRef.current && !scrubbingRef.current) {
        const pct = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0;
        playheadRef.current.style.left = `${pct}%`;
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [globalTime, totalDuration]);

  // Scrub handler
  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: MouseEvent) => {
      if (!scrubbingRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      // Snap to scene boundaries
      const timeSec = pct * totalDuration;
      const snapped = snapToSceneBoundary(timeSec, totalDuration, cumulativeStarts, storyboard, segments);
      onSeek(Math.max(0, Math.min(totalDuration, snapped.time)));
      // Update playhead directly for 60fps
      if (playheadRef.current) {
        playheadRef.current.style.left = `${(snapped.time / totalDuration) * 100}%`;
      }
      setSnapGuidePos(snapped.snapped ? (snapped.time / totalDuration) * 100 : null);
    };
    const onUp = () => {
      scrubbingRef.current = false;
      setScrubbing(false);
      setSnapGuidePos(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scrubbing, totalDuration, onSeek, cumulativeStarts, storyboard, segments]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay?.();
      } else if (e.code === "ArrowLeft" && onFrameStep) {
        e.preventDefault();
        onFrameStep(-1);
      } else if (e.code === "ArrowRight" && onFrameStep) {
        e.preventDefault();
        onFrameStep(1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onTogglePlay, onFrameStep]);

  // Ctrl+Scroll zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.85 : 1.18;
      setZoomLevel(z => Math.max(0.5, Math.min(20, z * delta)));
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, []);

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

  const textDraggedRef = useRef(false);

  const handleItemDragStart = useCallback((
    e: React.MouseEvent, type: "text" | "audio", id: string, leftPct: number, widthPct: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    textDraggedRef.current = false;
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
      const isClick = Math.abs(dx) < 3;

      if (!isClick) {
        textDraggedRef.current = true;
      }

      if (isClick && itemDragRef.current.type === "text") {
        // Single click on text — no action (double-click opens editor)
      } else if (isClick && itemDragRef.current.type === "audio") {
        // Click on audio — just deselect
      } else {
        // Actual drag — move item
        const deltaPct = (dx / trackWidth) * 100;
        const newLeftPct = Math.max(0, Math.min(100, itemDragRef.current.origLeftPct + deltaPct));
        const newTimeSec = (newLeftPct / 100) * totalDuration;

        if (itemDragRef.current.type === "text") {
          const { sceneIdx, localTime } = findSceneAtTime(newTimeSec);
          const targetSceneId = storyboard[sceneIdx]?.id;
          if (targetSceneId) {
            onMoveOverlay?.(itemDragRef.current.id, targetSceneId, localTime);
          }
        } else {
          onMoveAudioTrack?.(parseInt(itemDragRef.current.id), "", newTimeSec);
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

  // Drag-to-resize
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
      onResizeScene?.(dragState.current.index, Math.max(1, newDur));
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
    const rect = (trackRef.current ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const timeSec = pct * totalDuration;
    onSeek(Math.max(0, Math.min(totalDuration, timeSec)));
  };

  const getSceneDur = (i: number) => {
    const seg = segments.find(s => s.id === storyboard[i]?.segmentId);
    return seg ? seg.endTime - seg.startTime : 4;
  };

  // Scene drag-to-reorder
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

  // ─── Zoom-aware ruler ticks ───
  const rulerTicks = useMemo(() => {
    if (totalDuration <= 0) return [];
    const effectiveZoom = zoomLevel;
    let majorInterval: number;
    let minorInterval: number;
    if (effectiveZoom < 2) {
      majorInterval = 1; minorInterval = 0.5;
    } else if (effectiveZoom < 5) {
      majorInterval = 0.5; minorInterval = 0.1;
    } else if (effectiveZoom < 10) {
      majorInterval = 0.1; minorInterval = 0.05;
    } else {
      majorInterval = 0.1; minorInterval = 0.01;
    }

    const ticks: { time: number; pct: number; isMajor: boolean; label: string }[] = [];
    const step = minorInterval;
    const count = Math.ceil(totalDuration / step) + 1;
    // Virtualize: limit to ~600 ticks max
    const maxTicks = 600;
    const skipFactor = count > maxTicks ? Math.ceil(count / maxTicks) : 1;

    for (let i = 0; i <= count; i += skipFactor) {
      const time = +(i * step).toFixed(3);
      if (time > totalDuration) break;
      const pct = (time / totalDuration) * 100;
      const isMajor = Math.abs(time % majorInterval) < 0.001 || Math.abs(time % majorInterval - majorInterval) < 0.001;
      let label = "";
      if (isMajor) {
        if (effectiveZoom >= 5) {
          const s = Math.floor(time);
          const ms = Math.round((time - s) * 1000);
          label = ms === 0 ? `${s}s` : `${s}.${ms.toString().padStart(3, "0").replace(/0+$/, "")}`;
        } else {
          label = `${time}s`;
        }
      }
      ticks.push({ time, pct, isMajor, label });
    }
    return ticks;
  }, [totalDuration, zoomLevel]);

  // ─── Snap guide positions (scene boundaries) ───
  const sceneBoundaryPcts = useMemo(() => {
    const boundaries: number[] = [0];
    for (let i = 0; i < storyboard.length; i++) {
      const endTime = (cumulativeStarts[i] || 0) + getSceneDur(i);
      boundaries.push((endTime / totalDuration) * 100);
    }
    return boundaries;
  }, [storyboard, cumulativeStarts, totalDuration, segments]);

  return (
    <div className="border-t border-white/[0.06] bg-zinc-950 select-none">
      {/* ─── Top Toolbar ─── */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-white/[0.06]">
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">Timeline</span>
        {sidebarTabs.length > 0 && (
          <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-white/[0.06]">
            {sidebarTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onSidebarTabSelect?.(tab.id)}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors
                  ${activeSidebarTab === tab.id ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"}`}
                title={tab.label}
              >
                {tab.icon}
              </button>
            ))}
          </div>
        )}
        {/* Scene action buttons */}
        {selectedSceneIndex >= 0 && (
          <div className="flex items-center gap-0.5 ml-1.5 pl-1.5 border-l border-white/[0.06]">
            {onResizeScene && (
              <Button variant="ghost" size="sm" className={`h-6 w-6 p-0 transition-colors ${trimMode ? 'text-red-400 bg-red-500/20 hover:bg-red-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} onClick={() => setTrimMode(prev => !prev)} title={trimMode ? "Exit trim mode" : "Trim scene"}>
                <Scissors className="w-3 h-3" />
              </Button>
            )}
            {onStretchScene && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => onStretchScene(selectedSceneIndex)} title="Stretch (+1s)">
                <Expand className="w-3 h-3" />
              </Button>
            )}
            {onSplitScene && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => onSplitScene(selectedSceneIndex)} title="Split">
                <SplitSquareHorizontal className="w-3 h-3" />
              </Button>
            )}
            {onDuplicateScene && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => onDuplicateScene(selectedSceneIndex)} title="Duplicate">
                <Copy className="w-3 h-3" />
              </Button>
            )}
            {onMuteScene && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => onMuteScene(selectedSceneIndex)} title={mutedScenes?.has(storyboard[selectedSceneIndex]?.id) ? "Unmute" : "Mute"}>
                {mutedScenes?.has(storyboard[selectedSceneIndex]?.id) ? <VolumeOff className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </Button>
            )}
            {onRegenerateScene && (
              <Button
                variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white hover:bg-white/10"
                onClick={() => onRegenerateScene(storyboard[selectedSceneIndex]?.id)}
                disabled={clips.find(c => c.sceneId === storyboard[selectedSceneIndex]?.id)?.status !== "completed"}
                title="Regenerate"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            )}
            {onDeleteScene && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => onDeleteScene(selectedSceneIndex)} title="Delete">
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
        {onRegenerateAll && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[9px] gap-1 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            onClick={onRegenerateAll}
            disabled={isRegeneratingAll}
            title="Generate audio & text for all scenes"
          >
            {isRegeneratingAll ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            <span>{isRegeneratingAll ? "Generating…" : "Generate"}</span>
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost" size="sm"
          className="h-6 px-1.5 text-[9px] gap-1 text-zinc-400 hover:text-white hover:bg-white/10"
          onClick={() => setViewMode(v => v === "expanded" ? "compact" : "expanded")}
          title={viewMode === "expanded" ? "Compact view" : "Expanded view"}
        >
          {viewMode === "expanded" ? <LayoutGrid className="w-3 h-3" /> : <Rows3 className="w-3 h-3" />}
          {viewMode === "expanded" ? "Cards" : "Track"}
        </Button>
        {viewMode === "expanded" && (
          <>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => setZoomLevel(z => Math.max(z / 1.3, 0.5))} title="Zoom Out"><ZoomOut className="w-3 h-3" /></Button>
            <span className="text-[9px] text-zinc-500 font-mono min-w-[28px] text-center">{zoomLevel.toFixed(1)}×</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => setZoomLevel(z => Math.min(z * 1.3, 20))} title="Zoom In"><ZoomIn className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => setZoomLevel(1)} title="Fit"><Maximize className="w-3 h-3" /></Button>
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
                    ${isSelected ? "ring-2 ring-red-500" : "ring-1 ring-white/10"}
                    ${sceneDragIdx === i ? "opacity-40" : ""}
                    ${isDropTarget ? "ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-950" : ""}
                    ${isCompleted ? "bg-emerald-900/40" : isGenerating ? "bg-blue-900/30 animate-pulse" : "bg-zinc-800/40"}
                  `}
                >
                  {thumbnails[scene.id]?.[0] ? (
                    <>
                      <img src={thumbnails[scene.id][0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    </>
                  ) : null}
                  <span className="absolute top-0.5 left-0.5 text-[7px] px-1 py-px rounded-full bg-black/60 text-white font-mono z-10">{durSec}s</span>
                  <div className="absolute top-1 right-1 z-10">
                    <div className={`w-2 h-2 rounded-full ${isCompleted ? "bg-emerald-400" : isGenerating ? "bg-blue-400 animate-pulse" : "bg-zinc-600"}`} />
                  </div>
                  {onMoveScene && (
                    <GripVertical className="absolute top-1 left-[calc(50%-5px)] w-2.5 h-2.5 text-white/50 z-10" />
                  )}
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
      <div ref={scrollContainerRef} className="px-3 py-1.5 space-y-0 relative overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <div style={{ width: `${100 * zoomLevel}%`, minWidth: "100%" }}>

        {/* ─── Time Ruler ─── */}
        <div className="flex items-center gap-0.5 mb-0.5">
          <span className="w-14 shrink-0" />
          <div ref={rulerRef} className="flex-1 h-5 relative border-b border-white/[0.06] cursor-pointer"
            onClick={handleTrackClick}
          >
            {rulerTicks.map((tick, ti) => (
              <div key={ti} className="absolute top-0 bottom-0" style={{ left: `${tick.pct}%` }}>
                <div className={`absolute bottom-0 w-px ${tick.isMajor ? 'h-3 bg-zinc-500' : 'h-1.5 bg-zinc-700'}`} />
                {tick.label && (
                  <span className="absolute bottom-3.5 text-[7px] text-zinc-500 font-mono -translate-x-1/2 select-none whitespace-nowrap">
                    {tick.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── All Track Rows Wrapper (playhead spans all) ─── */}
        <div className="relative">

        {/* ─── Video Track ─── */}
        <div className="flex items-center gap-0.5">
          <VolumeControl label="Video" volume={videoVolume} onVolumeChange={onVideoVolumeChange} />
          <div
            ref={trackRef}
            className="flex-1 flex gap-px h-20 relative cursor-pointer rounded overflow-hidden bg-zinc-900/30"
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
                      onClick={(e) => { e.stopPropagation(); onSelectScene(i); if (trackRef.current) { const rect = trackRef.current.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width; onSeek(Math.max(0, Math.min(totalDuration, pct * totalDuration))); } }}
                      className={`relative h-full flex flex-col items-start justify-end transition-all cursor-pointer overflow-hidden rounded-sm
                        ${isSelected ? "ring-2 ring-red-500 ring-inset z-10" : "ring-1 ring-white/[0.06] ring-inset"}
                        ${isDropTarget ? "ring-2 ring-red-500 ring-inset" : ""}
                        ${sceneDragIdx === i ? "opacity-40" : ""}
                        ${isCompleted ? "bg-emerald-900/30" : isGenerating ? "bg-blue-900/20 animate-pulse" : "bg-zinc-800/40"}
                        hover:brightness-110
                      `}
                      style={{ flex: dur, willChange: "transform" }}
                      title={seg?.label || `Scene ${i + 1}`}
                    >
                      {/* Left drag handle */}
                      {onResizeScene && (
                        <div
                          onMouseDown={(e) => handleDragStart(e, i, "left")}
                          className={`absolute left-0 top-0 bottom-0 cursor-col-resize z-20 transition-all ${
                            trimMode && isSelected
                              ? 'w-3 bg-red-500/40 hover:bg-red-500/70 border-r border-red-400/60 flex items-center justify-center'
                              : 'w-1.5 hover:bg-red-500/50'
                          }`}
                        >
                          {trimMode && isSelected && <GripVertical className="w-2.5 h-2.5 text-white/80" />}
                        </div>
                      )}
                      {/* Thumbnails */}
                      {thumbnails[scene.id]?.length ? (
                        <>
                          <div className="absolute inset-0 flex">
                            {thumbnails[scene.id].map((frame, fi) => (
                              <img key={fi} src={frame} alt="" className="h-full object-cover flex-1 min-w-0" />
                            ))}
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        </>
                      ) : clip?.videoUrl ? (
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-800/20 to-emerald-700/20" />
                      ) : null}
                      {/* Status */}
                      <div className="absolute top-0.5 right-0.5 z-10">
                        <span className={`text-[7px] px-1 py-px rounded-full font-medium ${
                          isCompleted ? "bg-emerald-500/80 text-white" : isGenerating ? "bg-blue-500/80 text-white" : "bg-zinc-700/80 text-zinc-300"
                        }`}>
                          {isCompleted ? "done" : isGenerating ? "gen…" : clip?.status || "idle"}
                        </span>
                      </div>
                      {/* Duration */}
                      <div className="absolute top-0.5 left-0.5 z-10">
                        <span className="text-[7px] px-1 py-px rounded-full bg-black/60 text-white font-mono">{durSec}s</span>
                      </div>
                      {/* Drop indicator */}
                      {isDropTarget && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 z-30" />
                      )}
                      {/* Info */}
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
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                      )}
                      {/* Right drag handle */}
                      {onResizeScene && (
                        <div
                          onMouseDown={(e) => handleDragStart(e, i, "right")}
                          className={`absolute right-0 top-0 bottom-0 cursor-col-resize z-20 transition-all ${
                            trimMode && isSelected
                              ? 'w-3 bg-red-500/40 hover:bg-red-500/70 border-l border-red-400/60 flex items-center justify-center'
                              : 'w-1.5 hover:bg-red-500/50'
                          }`}
                        >
                          {trimMode && isSelected && <GripVertical className="w-2.5 h-2.5 text-white/80" />}
                        </div>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1.5 bg-zinc-900 border-white/10" side="top" align="center">
                    <div className="space-y-0.5">
                      <button onClick={() => onSelectScene(i)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200">Select</button>
                      {onEditPrompt && (
                        <button onClick={() => onEditPrompt(i)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <Edit3 className="w-2.5 h-2.5" />Edit Prompt
                        </button>
                      )}
                      {onEditVoiceover && (
                        <button onClick={() => onEditVoiceover(i)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <FileText className="w-2.5 h-2.5" />Edit Voiceover Text
                        </button>
                      )}
                      {onResizeScene && (
                        <button onClick={() => { onSelectScene(i); setTrimMode(true); }} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <Scissors className="w-2.5 h-2.5" />Trim Scene
                        </button>
                      )}
                      {onStretchScene && (
                        <button onClick={() => onStretchScene(i)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <Expand className="w-2.5 h-2.5" />Stretch (+1s)
                        </button>
                      )}
                      {onSplitScene && (
                        <button onClick={() => onSplitScene(i)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <SplitSquareHorizontal className="w-2.5 h-2.5" />Split
                        </button>
                      )}
                      {onDuplicateScene && (
                        <button onClick={() => onDuplicateScene(i)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <Copy className="w-2.5 h-2.5" />Duplicate
                        </button>
                      )}
                      {onMoveScene && i > 0 && (
                        <button onClick={() => onMoveScene(i, -1)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <ArrowLeft className="w-2.5 h-2.5" />Move Left
                        </button>
                      )}
                      {onMoveScene && i < storyboard.length - 1 && (
                        <button onClick={() => onMoveScene(i, 1)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <ArrowRight className="w-2.5 h-2.5" />Move Right
                        </button>
                      )}
                      {onMuteScene && (
                        <button onClick={() => onMuteScene(i)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <VolumeOff className="w-2.5 h-2.5" />{mutedScenes?.has(scene.id) ? "Unmute" : "Mute Scene"}
                        </button>
                      )}
                      {onRegenerateScene && clip?.status === "completed" && (
                        <button onClick={() => onRegenerateScene(scene.id)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-zinc-200 flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5" />Regenerate
                        </button>
                      )}
                      {onDeleteScene && (
                        <button onClick={() => onDeleteScene(i)} className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-red-500/20 text-red-400 flex items-center gap-1">
                          <Trash2 className="w-2.5 h-2.5" />Delete
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}

            {/* ─── Snap guide ─── */}
            {snapGuidePos != null && (
              <div className="absolute top-0 bottom-0 w-px z-30 pointer-events-none" style={{ left: `${snapGuidePos}%` }}>
                <div className="w-px h-full bg-yellow-400/60" style={{ borderLeft: "1px dashed" }} />
              </div>
            )}

          </div>
        </div>

        {/* ─── Text overlay track ─── */}
        {textOverlays.length > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <span className="w-14 shrink-0 text-[9px] text-zinc-500 flex items-center gap-1">
              <Type className="w-3 h-3" /> Text
            </span>
            <div className="flex-1 h-5 relative rounded bg-zinc-900/50 overflow-hidden" onClick={handleTrackClick}>
              {textOverlays.map((ov) => {
                const idx = storyboard.findIndex(s => s.id === ov.sceneId);
                if (idx < 0) return null;
                const sceneStart = cumulativeStarts[idx] || 0;
                const sceneDur = getSceneDur(idx);
                const itemStart = ov.startTime ?? 0;
                const itemEnd = ov.endTime ?? sceneDur;
                const absEnd = sceneStart + Math.min(itemEnd, sceneDur);
                const leftPct = 0;
                const widthPct = (absEnd / totalDuration) * 100;
                const isBeingDragged = draggedItemId === ov.id;
                return (
                  <div
                    key={ov.id}
                    className="absolute top-0.5 bottom-0.5 rounded-sm bg-violet-500/60 cursor-grab hover:bg-violet-500/80 transition-colors flex items-center px-1 group"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 0.8)}%`,
                      transform: isBeingDragged ? `translateX(${itemDragOffsetPx}px)` : undefined,
                      zIndex: isBeingDragged ? 30 : 5,
                      willChange: isBeingDragged ? 'transform' : undefined,
                    }}
                    onMouseDown={(e) => handleItemDragStart(e, "text", ov.id, leftPct, widthPct)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (textDraggedRef.current) { textDraggedRef.current = false; return; }
                      onEditOverlay?.(ov);
                    }}
                  >
                    <span className="text-[8px] text-white truncate select-none">{ov.content}</span>
                    {onDeleteOverlay && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteOverlay(ov.id); }}
                        className="hidden group-hover:flex absolute -right-1 -top-1 items-center justify-center w-4 h-4 rounded-full bg-red-600/80 hover:bg-red-500 z-10"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Audio (Voiceover) track ─── */}
        {(() => {
          const voiceoverTracks = audioTracks.map((t, i) => ({ track: t, origIdx: i })).filter(({ track }) => track.kind !== "music");
          const musicTracks = audioTracks.map((t, i) => ({ track: t, origIdx: i })).filter(({ track }) => track.kind === "music");
          return (<>
            {voiceoverTracks.length > 0 && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <span className="w-14 shrink-0 text-[9px] text-zinc-500 flex items-center gap-1">
                  <Music className="w-3 h-3" /> Audio
                </span>
                <div className="flex-1 h-5 relative rounded bg-zinc-900/50 overflow-hidden" onClick={(e) => { setSelectedAudioIdx(null); handleTrackClick(e); }}>
                  {voiceoverTracks.map(({ track, origIdx }) => {
                    let leftPct: number;
                    let widthPct: number;
                    if (track.globalStartTime != null && totalDuration > 0) {
                      const trackDur = track.duration ?? (track.endTime != null && track.startTime != null ? track.endTime - track.startTime : totalDuration);
                      leftPct = 0;
                      widthPct = ((track.globalStartTime + trackDur) / totalDuration) * 100;
                    } else {
                      const idx = storyboard.findIndex(s => s.id === track.sceneId);
                      if (idx < 0) { leftPct = 0; widthPct = 100; } else {
                        const sceneStart = cumulativeStarts[idx] || 0;
                        const sceneDur = getSceneDur(idx);
                        const itemEnd = track.endTime ?? sceneDur;
                        const absEnd = sceneStart + Math.min(itemEnd, sceneDur);
                        leftPct = 0;
                        widthPct = (absEnd / totalDuration) * 100;
                      }
                    }
                    const itemId = `audio-${origIdx}`;
                    const isBeingDragged = draggedItemId === itemId;
                    return (
                      <div
                        key={itemId}
                        className={`absolute top-0.5 bottom-0.5 rounded-sm cursor-grab transition-colors flex items-center px-1 group bg-teal-500/60 hover:bg-teal-500/80 ${selectedAudioIdx === origIdx ? 'ring-1 ring-white/60' : ''}`}
                        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.8)}%`, transform: isBeingDragged ? `translateX(${itemDragOffsetPx}px)` : undefined, zIndex: isBeingDragged ? 30 : 5, willChange: isBeingDragged ? 'transform' : undefined }}
                        onMouseDown={(e) => handleItemDragStart(e, "audio", String(origIdx), leftPct, widthPct)}
                        onClick={(e) => { e.stopPropagation(); setSelectedAudioIdx(origIdx); }}
                      >
                        <span className="text-[8px] text-white truncate select-none">🎙 {track.label}</span>
                        {onRemoveAudioTrack && (
                          <button onClick={(e) => { e.stopPropagation(); onRemoveAudioTrack(origIdx); }} className="hidden group-hover:flex absolute right-0.5 top-0.5 items-center justify-center w-3 h-3 rounded-full bg-black/40">
                            <Trash2 className="w-2 h-2 text-white/80" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Music track (always visible, yellow) ─── */}
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="w-14 shrink-0 text-[9px] text-zinc-500 flex items-center gap-1">
                <Music className="w-3 h-3" /> Music
              </span>
              <div className="flex-1 h-5 relative rounded bg-zinc-900/50 overflow-hidden" onClick={(e) => { setSelectedAudioIdx(null); handleTrackClick(e); }}>
                {musicTracks.length === 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] text-zinc-600 select-none">No music — click + to add</span>
                )}
                {musicTracks.map(({ track, origIdx }) => {
                  let leftPct: number;
                  let widthPct: number;
                  if (track.globalStartTime != null && totalDuration > 0) {
                    const trackDur = track.duration ?? (track.endTime != null && track.startTime != null ? track.endTime - track.startTime : totalDuration);
                    leftPct = 0;
                    widthPct = ((track.globalStartTime + trackDur) / totalDuration) * 100;
                  } else {
                    const idx = storyboard.findIndex(s => s.id === track.sceneId);
                    if (idx < 0) { leftPct = 0; widthPct = 100; } else {
                      const sceneStart = cumulativeStarts[idx] || 0;
                      const sceneDur = getSceneDur(idx);
                      const itemEnd = track.endTime ?? sceneDur;
                      const absEnd = sceneStart + Math.min(itemEnd, sceneDur);
                      leftPct = 0;
                      widthPct = (absEnd / totalDuration) * 100;
                    }
                  }
                  const itemId = `audio-${origIdx}`;
                  const isBeingDragged = draggedItemId === itemId;
                  return (
                    <div
                      key={itemId}
                      className={`absolute top-0.5 bottom-0.5 rounded-sm cursor-grab transition-colors flex items-center px-1 group bg-yellow-500/60 hover:bg-yellow-500/80 ${selectedAudioIdx === origIdx ? 'ring-1 ring-white/60' : ''}`}
                      style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.8)}%`, transform: isBeingDragged ? `translateX(${itemDragOffsetPx}px)` : undefined, zIndex: isBeingDragged ? 30 : 5, willChange: isBeingDragged ? 'transform' : undefined }}
                      onMouseDown={(e) => handleItemDragStart(e, "audio", String(origIdx), leftPct, widthPct)}
                      onClick={(e) => { e.stopPropagation(); setSelectedAudioIdx(origIdx); }}
                    >
                      <span className="text-[8px] text-white truncate select-none">🎵 {track.label}</span>
                      {onRemoveAudioTrack && (
                        <button onClick={(e) => { e.stopPropagation(); onRemoveAudioTrack(origIdx); }} className="hidden group-hover:flex absolute right-0.5 top-0.5 items-center justify-center w-3 h-3 rounded-full bg-black/40">
                          <Trash2 className="w-2 h-2 text-white/80" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>);
        })()}

        {/* ─── Global Playhead (spans all rows) ─── */}
        <div
          ref={playheadRef}
          className={`absolute top-0 bottom-0 z-50 ${scrubbing ? 'cursor-grabbing' : 'cursor-grab'} pointer-events-auto`}
          style={{ left: `${playheadPct}%`, width: '16px', transform: 'translateX(-7px)', willChange: 'left' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            scrubbingRef.current = true;
            setScrubbing(true);
          }}
        >
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-500 -translate-x-1/2" />
          <div className="absolute left-1/2 -translate-x-1/2 -top-0.5" style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #ef4444' }} />
          <div className={`absolute left-1/2 -translate-x-1/2 bottom-0 rounded-full bg-red-500 transition-transform ${scrubbing ? 'w-2 h-2' : 'w-1.5 h-1.5'}`} />
        </div>

        </div> {/* end wrapper with global playhead */}
        </div>
      </div>
      )}

      {/* ─── Transport Bar ─── */}
      <div className="flex items-center gap-2 px-3 py-1 border-t border-white/[0.06] bg-zinc-950">
        {/* Skip back */}
        <button
          onClick={() => { if (onSkipScene) onSkipScene(-1); else onSeek(0); }}
          className="text-zinc-500 hover:text-white transition-colors"
          title="Skip back"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        {/* Frame step back */}
        <button
          onClick={() => onFrameStep?.(-1)}
          className="text-zinc-500 hover:text-white transition-colors"
          title="Previous frame (←)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        {/* Frame step forward */}
        <button
          onClick={() => onFrameStep?.(1)}
          className="text-zinc-500 hover:text-white transition-colors"
          title="Next frame (→)"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        {/* Skip forward */}
        <button
          onClick={() => { if (onSkipScene) onSkipScene(1); else onSeek(totalDuration); }}
          className="text-zinc-500 hover:text-white transition-colors"
          title="Skip forward"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Time display */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[11px] text-white font-mono tabular-nums tracking-tight">
            {formatTimePrecise(globalTime)}
          </span>
          <span className="text-[10px] text-zinc-600">/</span>
          <span className="text-[11px] text-zinc-500 font-mono tabular-nums tracking-tight">
            {formatTimePrecise(totalDuration)}
          </span>
        </div>

        <div className="flex-1" />

        {/* Zoom slider */}
        {viewMode === "expanded" && (
          <div className="flex items-center gap-1.5">
            <ZoomOut className="w-3 h-3 text-zinc-600" />
            <input
              type="range"
              min={0.5}
              max={20}
              step={0.1}
              value={zoomLevel}
              onChange={(e) => setZoomLevel(+e.target.value)}
              className="w-20 h-1 accent-zinc-500 bg-zinc-800 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <ZoomIn className="w-3 h-3 text-zinc-600" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Snap helper ─── */
function snapToSceneBoundary(
  timeSec: number,
  totalDuration: number,
  cumulativeStarts: number[],
  storyboard: { segmentId: string }[],
  segments: { id: string; startTime: number; endTime: number }[],
  threshold = 0.15 // seconds
): { time: number; snapped: boolean } {
  const boundaries = [0, totalDuration];
  for (let i = 0; i < storyboard.length; i++) {
    boundaries.push(cumulativeStarts[i] || 0);
    const seg = segments.find(s => s.id === storyboard[i]?.segmentId);
    if (seg) boundaries.push((cumulativeStarts[i] || 0) + (seg.endTime - seg.startTime));
  }
  for (const b of boundaries) {
    if (Math.abs(timeSec - b) < threshold) {
      return { time: b, snapped: true };
    }
  }
  return { time: timeSec, snapped: false };
}

/* ─── Inline Volume Control ─── */
function VolumeControl({
  label, volume, onVolumeChange, hideSlider,
}: {
  label: string; volume: number; onVolumeChange?: (v: number) => void; hideSlider?: boolean;
}) {
  const isMuted = volume === 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-0.5 w-14 shrink-0 group" title={`${label} volume`}>
          {isMuted
            ? <VolumeX className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            : <Volume2 className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          }
          <span className="text-[9px] text-zinc-500 group-hover:text-zinc-300 truncate transition-colors">{label}</span>
        </button>
      </PopoverTrigger>
      {!hideSlider && onVolumeChange && (
        <PopoverContent className="w-40 p-2 bg-zinc-900 border-white/10" side="top" align="start">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-zinc-200">{label} Volume</p>
            <Slider
              value={[Math.round(volume * 100)]}
              min={0} max={100} step={1}
              onValueChange={([v]) => onVolumeChange(v / 100)}
              className="w-full"
            />
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-zinc-400">{Math.round(volume * 100)}%</span>
              <button
                onClick={() => onVolumeChange(isMuted ? 1 : 0)}
                className="text-[9px] text-zinc-400 hover:text-zinc-200"
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

function formatTimePrecise(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}:${ms.toString().padStart(3, "0")}`;
}
