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
} from "lucide-react";
import type { ClipOutput, StoryboardScene, ScriptSegment } from "@/types/adDirector";
import type { VideoOverlay } from "@/types/videoOverlay";

// ─── Thumbnail extraction helper ───────────────────────────
function useVideoThumbnails(clips: ClipOutput[]) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
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

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, video.duration / 2);
      };

      video.onseeked = () => {
        try {
          const c = document.createElement("canvas");
          c.width = 160;
          c.height = 90;
          const cx = c.getContext("2d");
          if (cx) {
            cx.drawImage(video, 0, 0, 160, 90);
            const dataUrl = c.toDataURL("image/jpeg", 0.6);
            setThumbnails(prev => ({ ...prev, [clip.sceneId]: dataUrl }));
          }
        } catch { /* CORS or other — ignore */ }
        video.src = "";
        video.load();
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
  // Drag-to-reposition
  onMoveOverlay?: (id: string, newSceneId: string) => void;
  onMoveAudioTrack?: (index: number, newSceneId: string) => void;
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
  const thumbnails = useVideoThumbnails(clips);

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
      onSeek(pct * totalDuration);
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

  // Find which scene a percentage position falls into
  const findSceneAtPct = useCallback((pct: number) => {
    for (let i = 0; i < storyboard.length; i++) {
      const start = (cumulativeStarts[i] || 0) / totalDuration * 100;
      const dur = getSceneDur(i);
      const end = start + (dur / totalDuration) * 100;
      if (pct >= start && pct < end) return i;
    }
    return storyboard.length - 1;
  }, [storyboard, cumulativeStarts, totalDuration]);

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
      const centerPct = itemDragRef.current.origLeftPct + itemDragRef.current.origWidthPct / 2 + deltaPct;
      const targetIdx = findSceneAtPct(Math.max(0, Math.min(100, centerPct)));
      const targetSceneId = storyboard[targetIdx]?.id;

      if (targetSceneId) {
        if (itemDragRef.current.type === "text") {
          onMoveOverlay?.(itemDragRef.current.id, targetSceneId);
        } else {
          onMoveAudioTrack?.(parseInt(itemDragRef.current.id), targetSceneId);
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
  }, [itemDragging, storyboard, findSceneAtPct, onMoveOverlay, onMoveAudioTrack]);

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
    const clickedTime = pct * totalDuration;
    onSeek(Math.max(0, Math.min(totalDuration, clickedTime)));
  };

  const getSceneDur = (i: number) => {
    const seg = segments.find(s => s.id === storyboard[i]?.segmentId);
    return seg ? seg.endTime - seg.startTime : 4;
  };

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
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ZoomOut className="w-3 h-3" /></Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ZoomIn className="w-3 h-3" /></Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Maximize className="w-3 h-3" /></Button>
      </div>

      {/* Tracks */}
      <div className="px-3 py-2 space-y-1.5 relative">
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

              return (
                <Popover key={scene.id}>
                  <PopoverTrigger asChild>
                    <div
                      onClick={(e) => { e.stopPropagation(); onSelectScene(i); }}
                      className={`relative h-full flex flex-col items-start justify-end transition-all cursor-pointer overflow-hidden
                        ${isSelected ? "ring-2 ring-primary ring-inset z-10" : ""}
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
                      {thumbnails[scene.id] ? (
                        <>
                          <img
                            src={thumbnails[scene.id]}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                          />
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
              style={{ left: `${playheadPct}%`, width: '14px', transform: 'translateX(-6px)' }}
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

        {/* ─── Text track ─── */}
        <div className="flex items-center gap-0.5">
          <VolumeControl
            label="Text"
            volume={textTrackMuted ? 0 : 1}
            onVolumeChange={() => setTextTrackMuted(!textTrackMuted)}
            hideSlider
          />
          <div className="flex-1 h-7 rounded bg-muted/10 border border-dashed border-border/30 flex items-center relative overflow-hidden">
            {textOverlays.length > 0 ? (
              <>
                {textOverlays.map(ov => {
                  const sceneIdx = storyboard.findIndex(s => s.id === ov.sceneId);
                  if (sceneIdx < 0) return null;
                  const start = cumulativeStarts[sceneIdx] || 0;
                  const dur = getSceneDur(sceneIdx);
                  const leftPct = totalDuration > 0 ? (start / totalDuration) * 100 : 0;
                  const widthPct = totalDuration > 0 ? (dur / totalDuration) * 100 : 0;
                  const isDragTarget = draggedItemId === ov.id;
                  return (
                    <Popover key={ov.id}>
                      <PopoverTrigger asChild>
                        <div
                          onMouseDown={(e) => handleItemDragStart(e, "text", ov.id, leftPct, widthPct)}
                          className={`absolute h-5 top-1 rounded bg-amber-600/50 border flex items-center px-1 cursor-grab active:cursor-grabbing transition-colors ${isDragTarget ? "border-primary ring-1 ring-primary/50 z-30" : "border-amber-500/40 hover:bg-amber-600/70"}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            transform: isDragTarget ? `translateX(${itemDragOffsetPx}px)` : undefined,
                          }}
                          title={ov.content}
                        >
                          <Move className="w-2 h-2 text-amber-300 mr-0.5 shrink-0" />
                          <span className="text-[7px] text-white truncate">{ov.content}</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-1.5" side="top" align="center">
                        <div className="space-y-0.5">
                          {onEditOverlay && (
                            <button
                              onClick={() => onEditOverlay(ov)}
                              className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                            ><Edit3 className="w-2.5 h-2.5" />Edit Text</button>
                          )}
                          {onEditOverlayPosition && (
                            <>
                              <p className="text-[9px] text-muted-foreground px-2 pt-1">Position</p>
                              <div className="flex gap-1 px-2">
                                {(["top", "center", "bottom"] as const).map(pos => (
                                  <button
                                    key={pos}
                                    onClick={() => onEditOverlayPosition(ov.id, pos)}
                                    className="flex-1 text-[9px] py-0.5 rounded border border-border/40 hover:bg-accent/50 text-foreground capitalize"
                                  >{pos}</button>
                                ))}
                              </div>
                            </>
                          )}
                          {onResizeOverlay && (
                            <>
                              <p className="text-[9px] text-muted-foreground px-2 pt-1">Size</p>
                              <div className="flex gap-1 px-2">
                                {(["small", "medium", "large"] as const).map(sz => (
                                  <button
                                    key={sz}
                                    onClick={() => onResizeOverlay(ov.id, sz)}
                                    className="flex-1 text-[9px] py-0.5 rounded border border-border/40 hover:bg-accent/50 text-foreground capitalize"
                                  >{sz}</button>
                                ))}
                              </div>
                            </>
                          )}
                          {onToggleOverlayAnimation && (
                            <button
                              onClick={() => onToggleOverlayAnimation(ov.id)}
                              className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent/50 text-foreground flex items-center gap-1"
                            ><Sparkles className="w-2.5 h-2.5" />{ov.animated ? "Disable Animation" : "Enable Animation"}</button>
                          )}
                          {onDeleteOverlay && (
                            <button
                              onClick={() => onDeleteOverlay(ov.id)}
                              className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-destructive/20 text-destructive flex items-center gap-1"
                            ><Trash2 className="w-2.5 h-2.5" />Delete</button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
                <button
                  onClick={onAddText}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground z-10"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </>
            ) : (
              <button
                onClick={onAddText}
                className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors mx-auto"
              >
                <Plus className="w-2.5 h-2.5" />
                <Type className="w-2.5 h-2.5" />
                Add text
              </button>
            )}
          </div>
        </div>

        {/* ─── Audio track ─── */}
        <div className="flex items-center gap-0.5">
          <VolumeControl
            label="Audio"
            volume={audioTracks.length > 0 ? (audioTracks[0]?.volume ?? 1) : 1}
            onVolumeChange={(v) => {
              // Apply to all audio tracks
              audioTracks.forEach((_, idx) => onAudioTrackVolumeChange?.(idx, v));
            }}
          />
          <div className="flex-1 h-7 rounded bg-muted/10 border border-dashed border-border/30 flex items-center relative overflow-hidden">
            {audioTracks.length > 0 ? (
              <>
                {audioTracks.map((at, idx) => {
                  if (at.kind === "music") {
                    return (
                      <Popover key={`music-${idx}`}>
                        <PopoverTrigger asChild>
                          <div
                            className="absolute h-5 top-1 rounded bg-purple-600/40 border border-purple-500/40 flex items-center px-1 cursor-pointer hover:bg-purple-600/60 transition-colors"
                            style={{ left: 0, width: "100%" }}
                            title="Background Music"
                          >
                            <Music className="w-2.5 h-2.5 text-purple-300 mr-0.5" />
                            <span className="text-[7px] text-purple-200 truncate">Music</span>
                            <span className="text-[7px] text-purple-300/60 ml-1">{Math.round((at.volume ?? 1) * 100)}%</span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-2" side="top" align="center">
                          <div className="space-y-2">
                            <p className="text-[10px] font-medium text-foreground">Music Volume</p>
                            <Slider
                              value={[Math.round((at.volume ?? 1) * 100)]}
                              min={0} max={100} step={1}
                              onValueChange={([v]) => onAudioTrackVolumeChange?.(idx, v / 100)}
                              className="w-full"
                            />
                            <div className="flex justify-between">
                              <span className="text-[9px] text-muted-foreground">{Math.round((at.volume ?? 1) * 100)}%</span>
                              {onRemoveAudioTrack && (
                                <button
                                  onClick={() => onRemoveAudioTrack(idx)}
                                  className="text-[9px] text-destructive hover:underline flex items-center gap-0.5"
                                ><Trash2 className="w-2.5 h-2.5" />Remove</button>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  }
                  const sceneIdx = storyboard.findIndex(s => s.id === at.sceneId);
                  if (sceneIdx < 0) return null;
                  const start = cumulativeStarts[sceneIdx] || 0;
                  const dur = getSceneDur(sceneIdx);
                  const leftPct = totalDuration > 0 ? (start / totalDuration) * 100 : 0;
                  const widthPct = totalDuration > 0 ? (dur / totalDuration) * 100 : 0;
                  const isAudioDragTarget = draggedItemId === `audio-${idx}`;
                  return (
                    <Popover key={`vo-${idx}`}>
                      <PopoverTrigger asChild>
                        <div
                          onMouseDown={(e) => handleItemDragStart(e, "audio", String(idx), leftPct, widthPct)}
                          className={`absolute h-5 top-1 rounded bg-sky-600/50 border flex items-center px-1 cursor-grab active:cursor-grabbing transition-colors ${isAudioDragTarget ? "border-primary ring-1 ring-primary/50 z-30" : "border-sky-500/40 hover:bg-sky-600/70"}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            transform: isAudioDragTarget ? `translateX(${itemDragOffsetPx}px)` : undefined,
                          }}
                          title={at.label}
                        >
                          <Move className="w-2 h-2 text-sky-300 mr-0.5 shrink-0" />
                          <Mic className="w-2 h-2 text-sky-300 mr-0.5" />
                          <span className="text-[7px] text-sky-200 truncate">{at.label}</span>
                          <span className="text-[7px] text-sky-300/60 ml-1">{Math.round((at.volume ?? 1) * 100)}%</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-2" side="top" align="center">
                          <div className="space-y-2">
                            <p className="text-[10px] font-medium text-foreground">{at.label} Volume</p>
                            <Slider
                              value={[Math.round((at.volume ?? 1) * 100)]}
                              min={0} max={100} step={1}
                              onValueChange={([v]) => onAudioTrackVolumeChange?.(idx, v / 100)}
                              className="w-full"
                            />
                            <div className="flex justify-between">
                              <span className="text-[9px] text-muted-foreground">{Math.round((at.volume ?? 1) * 100)}%</span>
                              {onRemoveAudioTrack && (
                                <button
                                  onClick={() => onRemoveAudioTrack(idx)}
                                  className="text-[9px] text-destructive hover:underline flex items-center gap-0.5"
                                ><Trash2 className="w-2.5 h-2.5" />Remove</button>
                              )}
                            </div>
                            <div className="border-t border-border/30 pt-1.5 space-y-1.5">
                              <p className="text-[9px] text-muted-foreground">Voiceover Text</p>
                              <textarea
                                className="w-full text-[10px] bg-muted/30 border border-border/30 rounded p-1.5 min-h-[48px] max-h-[80px] resize-none focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                                value={voiceoverTexts[at.sceneId] ?? (() => {
                                  const sc = storyboard.find(s => s.id === at.sceneId);
                                  const sg = segments.find(s => s.id === sc?.segmentId);
                                  return sc?.voiceover || sg?.text || "";
                                })()}
                                onChange={(e) => setVoiceoverTexts(prev => ({ ...prev, [at.sceneId]: e.target.value }))}
                                placeholder="Enter voiceover text…"
                              />
                              <div className="flex gap-1">
                                {onUpdateVoiceoverText && (
                                  <button
                                    onClick={() => {
                                      const txt = voiceoverTexts[at.sceneId]?.trim();
                                      if (txt) onUpdateVoiceoverText(at.sceneId, txt);
                                    }}
                                    disabled={!voiceoverTexts[at.sceneId]?.trim()}
                                    className="flex-1 text-[9px] px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center gap-1 disabled:opacity-40"
                                  ><Edit3 className="w-2.5 h-2.5" />Save Text</button>
                                )}
                                {onReRecordVoiceover && (
                                  <button
                                    onClick={() => onReRecordVoiceover(at.sceneId, voiceoverTexts[at.sceneId]?.trim() || undefined)}
                                    className="flex-1 text-[9px] px-2 py-1 rounded bg-accent/50 hover:bg-accent text-foreground flex items-center justify-center gap-1"
                                  ><RotateCcw className="w-2.5 h-2.5" />Re-record</button>
                                )}
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                    </Popover>
                  );
                })}
                <button
                  onClick={onAddAudio}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground z-10"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </>
            ) : (
              <button
                onClick={onAddAudio}
                className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors mx-auto"
              >
                <Plus className="w-2.5 h-2.5" />
                <Mic className="w-2.5 h-2.5" />
                Upload audio
              </button>
            )}
          </div>
        </div>
      </div>
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
