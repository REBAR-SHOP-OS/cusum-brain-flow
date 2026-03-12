import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Music, Type, Plus, Mic } from "lucide-react";
import type { ClipOutput, StoryboardScene, ScriptSegment } from "@/types/adDirector";
import type { VideoOverlay } from "@/types/videoOverlay";

export interface AudioTrackItem {
  sceneId: string;
  label: string;
  audioUrl: string;
  kind: "voiceover" | "music";
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
}

export function TimelineBar({
  clips, storyboard, segments, globalTime, totalDuration,
  cumulativeStarts, selectedSceneIndex, onSeek, onSelectScene,
  onAddText, onAddAudio, textOverlays = [], audioTracks = [],
}: TimelineBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const playheadPct = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0;

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const clickedTime = pct * totalDuration;
    onSeek(Math.max(0, Math.min(totalDuration, clickedTime)));
  };

  // Get scene duration
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
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ZoomOut className="w-3 h-3" /></Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ZoomIn className="w-3 h-3" /></Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Maximize className="w-3 h-3" /></Button>
      </div>

      {/* Tracks */}
      <div className="px-3 py-2 space-y-1.5 relative">
        {/* Video track */}
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground w-12 shrink-0 truncate">Video</span>
          <div
            ref={trackRef}
            className="flex-1 flex gap-px h-12 relative cursor-pointer rounded overflow-hidden"
            onClick={handleTrackClick}
          >
            {storyboard.map((scene, i) => {
              const dur = getSceneDur(i);
              const clip = clips.find(c => c.sceneId === scene.id);
              const seg = segments.find(s => s.id === scene.segmentId);
              const isSelected = i === selectedSceneIndex;
              const isCompleted = clip?.status === "completed";
              const isGenerating = clip?.status === "generating";

              return (
                <div
                  key={scene.id}
                  onClick={(e) => { e.stopPropagation(); onSelectScene(i); }}
                  className={`relative h-full flex items-center justify-center transition-all cursor-pointer
                    ${isSelected ? "ring-2 ring-primary ring-inset z-10" : ""}
                    ${isCompleted ? "bg-emerald-900/40" : isGenerating ? "bg-blue-900/30 animate-pulse" : "bg-muted/30"}
                  `}
                  style={{ flex: dur }}
                  title={seg?.label || `Scene ${i + 1}`}
                >
                  {clip?.videoUrl && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-800/20 to-emerald-700/20" />
                  )}
                  <span className="text-[8px] text-muted-foreground font-medium z-10 truncate px-1">
                    {seg?.label || `S${i + 1}`}
                  </span>
                  {isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="w-2 h-2 bg-white rounded-full -translate-x-[3px] -translate-y-0.5" />
            </div>
          </div>
        </div>

        {/* Text track */}
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground w-12 shrink-0 truncate">Text</span>
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
                  return (
                    <div
                      key={ov.id}
                      className="absolute h-5 top-1 rounded bg-amber-600/50 border border-amber-500/40 flex items-center px-1"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={ov.content}
                    >
                      <span className="text-[7px] text-white truncate">{ov.content}</span>
                    </div>
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

        {/* Audio track */}
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground w-12 shrink-0 truncate">Audio</span>
          <div className="flex-1 h-7 rounded bg-muted/10 border border-dashed border-border/30 flex items-center relative overflow-hidden">
            {audioTracks.length > 0 ? (
              <>
                {audioTracks.map((at, idx) => {
                  if (at.kind === "music") {
                    return (
                      <div
                        key={`music-${idx}`}
                        className="absolute h-5 top-1 rounded bg-purple-600/40 border border-purple-500/40 flex items-center px-1"
                        style={{ left: 0, width: "100%" }}
                        title="Background Music"
                      >
                        <Music className="w-2.5 h-2.5 text-purple-300 mr-0.5" />
                        <span className="text-[7px] text-purple-200 truncate">Music</span>
                      </div>
                    );
                  }
                  const sceneIdx = storyboard.findIndex(s => s.id === at.sceneId);
                  if (sceneIdx < 0) return null;
                  const start = cumulativeStarts[sceneIdx] || 0;
                  const dur = getSceneDur(sceneIdx);
                  const leftPct = totalDuration > 0 ? (start / totalDuration) * 100 : 0;
                  const widthPct = totalDuration > 0 ? (dur / totalDuration) * 100 : 0;
                  return (
                    <div
                      key={`vo-${idx}`}
                      className="absolute h-5 top-1 rounded bg-sky-600/50 border border-sky-500/40 flex items-center px-1"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={at.label}
                    >
                      <Mic className="w-2 h-2 text-sky-300 mr-0.5" />
                      <span className="text-[7px] text-sky-200 truncate">{at.label}</span>
                    </div>
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
                <Music className="w-2.5 h-2.5" />
                Add audio
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
