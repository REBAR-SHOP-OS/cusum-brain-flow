import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Music, Type, Plus } from "lucide-react";
import type { ClipOutput, StoryboardScene, ScriptSegment } from "@/types/adDirector";

interface TimelineBarProps {
  clips: ClipOutput[];
  storyboard: StoryboardScene[];
  segments: ScriptSegment[];
  currentTime: number;
  duration: number;
  selectedSceneIndex: number;
  onSeek: (pct: number) => void;
  onSelectScene: (index: number) => void;
}

export function TimelineBar({
  clips, storyboard, segments, currentTime, duration,
  selectedSceneIndex, onSeek, onSelectScene,
}: TimelineBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const totalDuration = segments.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) || 30;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div className="border-t border-border/40 bg-card/80 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Timeline</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <ZoomOut className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Maximize className="w-3 h-3" />
        </Button>
      </div>

      {/* Video track */}
      <div className="px-3 py-2 space-y-1.5 relative">
        {/* Scene filmstrip */}
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground w-12 shrink-0 truncate">Video</span>
          <div
            ref={trackRef}
            className="flex-1 flex gap-px h-12 relative cursor-pointer rounded overflow-hidden"
            onClick={handleTrackClick}
          >
            {storyboard.map((scene, i) => {
              const seg = segments.find(s => s.id === scene.segmentId);
              const dur = seg ? seg.endTime - seg.startTime : 4;
              const clip = clips.find(c => c.sceneId === scene.id);
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

        {/* Text track (placeholder) */}
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground w-12 shrink-0 truncate">Text</span>
          <div className="flex-1 h-7 rounded bg-muted/10 border border-dashed border-border/30 flex items-center justify-center">
            <button className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="w-2.5 h-2.5" />
              <Type className="w-2.5 h-2.5" />
              Add text
            </button>
          </div>
        </div>

        {/* Audio track (placeholder) */}
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground w-12 shrink-0 truncate">Audio</span>
          <div className="flex-1 h-7 rounded bg-muted/10 border border-dashed border-border/30 flex items-center justify-center">
            <button className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="w-2.5 h-2.5" />
              <Music className="w-2.5 h-2.5" />
              Add audio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
